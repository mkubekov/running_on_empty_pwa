import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { PageHeader } from '@/app/Layout'
import { Empty, Line, NavRow, Panel, Sheet } from '@/app/ui'
import { useCategoryStats, useLogsInRange } from '@/db/queries'
import type { CategoryStat } from '@/db/queries'
import { dayKeyToDate, lastNDays } from '@/lib/date'
import { withPlural } from '@/lib/plural'

const RANGES = [
  { days: 30, label: 'месяц' },
  { days: 90, label: 'три месяца' },
] as const

/** Группа с полоской. Тап раскрывает слова, из которых она набралась. */
function CategoryRow({
  stat,
  max,
  open,
  onToggle,
}: {
  stat: CategoryStat
  max: number
  open: boolean
  onToggle: () => void
}) {
  const color =
    stat.valence === 'heavy' ? 'var(--color-violet)' : 'var(--color-sepia)'

  return (
    <Line note={String(stat.count)}>
      {/*
        Название и полоска на разных строках: «Разгневанный» и «Безразличный»
        в одну строку с полоской не помещаются и обрезаются многоточием.
      */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-11 w-full flex-col justify-center gap-1.5 text-left"
      >
        <span className="font-book text-body leading-snug">{stat.title}</span>
        <span className="h-2.5 w-full bg-rule">
          <span
            className="block h-full"
            style={{
              width: `${(stat.count / max) * 100}%`,
              backgroundColor: color,
            }}
          />
        </span>
      </button>

      {open && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {stat.words.map((w) => (
            <span key={w.id} className="font-book text-form text-pencil">
              {w.word}{' '}
              <span className="font-form text-note tabular-nums">{w.count}</span>
            </span>
          ))}
        </div>
      )}
    </Line>
  )
}

export function SummaryScreen() {
  const [days, setDays] = useState<number>(30)
  const [openCategory, setOpenCategory] = useState<string | null>(null)

  const logs = useLogsInRange(days)
  const stats = useCategoryStats(days)

  const countByDate = useMemo(() => {
    const map = new Map<string, number>()
    for (const log of logs) map.set(log.date, (map.get(log.date) ?? 0) + 1)
    return map
  }, [logs])

  const calendar = lastNDays(days)
  const filledDays = calendar.filter((d) => countByDate.has(d)).length
  const top = stats.slice(0, 12)
  const max = top[0]?.count ?? 1

  return (
    <div className="space-y-6">
      <PageHeader
        title="Сводка"
        subtitle={withPlural(logs.length, ['запись', 'записи', 'записей'])}
        action={
          <div className="flex shrink-0 gap-3">
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
        }
      />

      <Panel title="Что возвращается чаще">
        {top.length === 0 ? (
          <Empty>
            Картина появится через пару недель записей. Пока записывать важнее, чем
            смотреть.
          </Empty>
        ) : (
          <>
            <Sheet>
              {top.map((stat) => (
                <CategoryRow
                  key={stat.categoryId}
                  stat={stat}
                  max={max}
                  open={openCategory === stat.categoryId}
                  onToggle={() =>
                    setOpenCategory(
                      openCategory === stat.categoryId ? null : stat.categoryId,
                    )
                  }
                />
              ))}
            </Sheet>
            <p className="mt-3 font-form text-note leading-relaxed text-pencil">
              Группы из словаря книги. Тап по строке покажет, из каких слов она
              набралась.
            </p>
          </>
        )}
      </Panel>

      <Panel title="Дни с записями">
        <div
          className="grid grid-cols-[repeat(auto-fill,minmax(10px,1fr))] gap-[3px]"
          role="img"
          aria-label={`Дней с записями: ${filledDays} из ${days}`}
        >
          {calendar.map((date) => {
            const n = countByDate.get(date) ?? 0
            return (
              <div
                key={date}
                title={`${format(dayKeyToDate(date), 'd MMMM', { locale: ru })} — ${n}`}
                className="aspect-square"
                style={{
                  backgroundColor:
                    n === 0 ? 'var(--color-rule)' : 'var(--color-violet)',
                  opacity: n === 0 ? 1 : 0.35 + Math.min(n, 3) * 0.22,
                }}
              />
            )
          })}
        </div>
        <p className="mt-3 font-form text-note leading-relaxed text-pencil">
          Отмечено {filledDays} из {days}. Пропуски ничего не обнуляют.
        </p>
      </Panel>

      <Panel title="Записи">
        <Sheet ruled={false}>
          <NavRow
            to="/history/entries"
            title="Все записи"
            hint="Перечитать, найти нужную, исправить"
            note={String(logs.length)}
          />
        </Sheet>
      </Panel>
    </div>
  )
}
