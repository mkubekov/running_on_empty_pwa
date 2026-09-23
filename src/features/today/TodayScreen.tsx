import { Link, useSearchParams } from 'react-router'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { PageHeader } from '@/app/Layout'
import { Button, Empty, Line, Panel, Sheet } from '@/app/ui'
import { db } from '@/db/schema'
import { useActiveTrackers, useLogsForDay, useOpenApplications } from '@/db/queries'
import { getTracker } from '@/content/trackers'
import { emotionWords } from '@/content/emotions'
import { timeLabel } from '@/lib/date'
import { TrackerWidget } from '@/features/trackers/TrackerWidget'

export function TodayScreen() {
  const [params, setParams] = useSearchParams()
  const logs = useLogsForDay()
  const activeTrackers = useActiveTrackers()
  const openApplications = useOpenApplications()

  const savedId = params.get('saved')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Сегодня"
        subtitle={format(new Date(), 'EEEE, d MMMM', { locale: ru })}
      />

      {savedId && (
        <Panel title="Записано" className="border-violet">
          <div className="flex items-center gap-4">
            <Link to={`/iaaa?logId=${savedId}`} className="flex-1">
              <Button variant="write" className="w-full">
                Разобрать чувство
              </Button>
            </Link>
            <Button
              variant="quiet"
              className="px-0"
              onClick={() => {
                params.delete('saved')
                setParams(params, { replace: true })
              }}
            >
              Не сейчас
            </Button>
          </div>
        </Panel>
      )}

      <Panel title="Лист эмоций">
        {logs.length === 0 ? (
          <Empty>Сегодня вы ещё ничего не записывали.</Empty>
        ) : (
          <Sheet>
            {logs.map((log) => (
              <Line key={log.id} note={timeLabel(log.at)}>
                <p className="font-book text-word leading-snug">
                  {emotionWords(log.emotionIds).join(', ')}
                </p>
                {log.cause && (
                  <p className="mt-1.5 font-book text-form leading-[1.7] whitespace-pre-line text-pencil">
                    {log.cause}
                  </p>
                )}
              </Line>
            ))}
          </Sheet>
        )}

        <Link to="/log" className="mt-4 block">
          <Button variant="write" className="w-full">
            Записать, что я чувствую
          </Button>
        </Link>
      </Panel>

      {openApplications.length > 0 && (
        <Panel title="Намечено разобраться">
          <Sheet>
            {openApplications.map((entry) => (
              <Line
                key={entry.id}
                note={emotionWords(entry.emotionIds)[0]?.toLowerCase()}
              >
                <p className="font-book text-body leading-[1.7] whitespace-pre-line">
                  {entry.application}
                </p>
                <div className="mt-2 flex items-center gap-4">
                  <Button
                    variant="quiet"
                    className="px-0 text-form"
                    onClick={() =>
                      void db.iaaaEntries.update(entry.id, { applicationState: 2 })
                    }
                  >
                    Сделал
                  </Button>
                  <Button
                    variant="quiet"
                    className="px-0 text-form"
                    onClick={() =>
                      void db.iaaaEntries.update(entry.id, { applicationState: 0 })
                    }
                  >
                    Уже неактуально
                  </Button>
                </div>
              </Line>
            ))}
          </Sheet>
        </Panel>
      )}

      {activeTrackers.length === 0 ? (
        <Panel title="Навыки">
          <Empty>
            Ни один лист не начат. Возьмите один навык и доведите его — за всё сразу
            браться бесполезно.
          </Empty>
          <Link to="/skills" className="mt-2 inline-block">
            <Button>Выбрать навык</Button>
          </Link>
        </Panel>
      ) : (
        // Каждый навык — своя графа: два листа в одной коробке слипаются.
        [...activeTrackers]
          .sort(
            (a, b) =>
              (getTracker(a.trackerId)?.order ?? 99) -
              (getTracker(b.trackerId)?.order ?? 99),
          )
          .map((state) => {
            const def = getTracker(state.trackerId)
            if (!def) return null
            return (
              <Panel key={state.trackerId} title={state.customTitle ?? def.title}>
                <TrackerWidget def={def} />
                <Link
                  to={`/skills/${def.id}`}
                  className="mt-3 inline-flex min-h-11 items-center font-form text-form text-pencil hover:text-ink"
                >
                  История листа
                </Link>
              </Panel>
            )
          })
      )}

      <Link
        to="/recovery"
        className="inline-flex min-h-11 items-center font-form text-form text-pencil hover:text-ink"
      >
        Я сбился с практики
      </Link>
    </div>
  )
}
