import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { PageHeader } from '@/app/Layout'
import { Empty, Line, Panel, Sheet } from '@/app/ui'
import { useLogsInRange } from '@/db/queries'
import { normalize, resolveEmotion } from '@/content/emotions'
import { dayKeyToDate, timeLabel } from '@/lib/date'
import { withPlural } from '@/lib/plural'

const RANGES = [
  { days: 30, label: 'месяц' },
  { days: 90, label: 'три месяца' },
  { days: 3650, label: 'всё' },
] as const

export function EntriesScreen() {
  const [days, setDays] = useState<number>(90)
  const [query, setQuery] = useState('')
  const logs = useLogsInRange(days)

  /** Ищем и по словам эмоций, и по тексту причины — заранее не угадать, что вспомнится. */
  const found = useMemo(() => {
    const q = normalize(query)
    const newestFirst = [...logs].reverse()
    if (!q) return newestFirst

    return newestFirst.filter((log) => {
      const words = log.emotionIds.map((id) => resolveEmotion(id).word).join(' ')
      return normalize(`${words} ${log.cause} ${log.bodyNote}`).includes(q)
    })
  }, [logs, query])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Все записи"
        subtitle={withPlural(found.length, ['запись', 'записи', 'записей'])}
        action={
          <Link
            to="/history"
            className="inline-flex min-h-11 shrink-0 items-center font-form text-form text-pencil hover:text-ink"
          >
            Назад
          </Link>
        }
      />

      <Panel title="Поиск">
        <input
          type="search"
          inputMode="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Слово или кусок причины"
          aria-label="Искать по записям"
          className="min-h-11 w-full border-b border-rule-strong bg-transparent font-book text-body text-ink outline-none focus:border-violet"
        />
        <div className="mt-3 flex gap-3">
          {RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              onClick={() => setDays(r.days)}
              aria-pressed={days === r.days}
              className={`inline-flex min-h-11 items-center font-form text-form transition-colors ${
                days === r.days
                  ? 'text-ink underline decoration-violet underline-offset-4'
                  : 'text-pencil hover:text-ink'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </Panel>

      <Panel title={query ? 'Найдено' : 'Записи'}>
        {found.length === 0 ? (
          <Empty>
            {query
              ? 'Ничего не нашлось. Попробуйте другое слово или расширьте период.'
              : 'Здесь будет всё, что вы записали.'}
          </Empty>
        ) : (
          <Sheet>
            {found.map((log) => (
              <Line
                key={log.id}
                note={
                  <>
                    {format(dayKeyToDate(log.date), 'd MMM', { locale: ru })}
                    <br />
                    {timeLabel(log.at)}
                  </>
                }
              >
                <Link to={`/log?edit=${log.id}`} className="block py-1">
                  <p className="font-book text-word leading-snug">
                    {log.emotionIds.map((id) => resolveEmotion(id).word).join(', ')}
                  </p>
                  {log.cause && (
                    <p className="mt-1.5 font-book text-form leading-[1.7] whitespace-pre-line text-pencil">
                      {log.cause}
                    </p>
                  )}
                  {log.bodyNote && (
                    <p className="mt-1.5 font-form text-note text-pencil">
                      В теле: {log.bodyNote}
                    </p>
                  )}
                </Link>
              </Line>
            ))}
          </Sheet>
        )}
      </Panel>
    </div>
  )
}
