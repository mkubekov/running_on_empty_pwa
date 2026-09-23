import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { PageHeader } from '@/app/Layout'
import { Button, FromBook, Panel, TextArea } from '@/app/ui'
import { getTracker } from '@/content/trackers'
import { useTrackerHistory, useTrackerState } from '@/db/queries'
import { db } from '@/db/schema'
import type { TrackerDay } from '@/db/schema'
import { TrackerWidget } from './TrackerWidget'
import { dayKeyToDate } from '@/lib/date'

/** Вес дня для полоски истории. 0 — день просто не отмечен, и это нормально. */
function dayWeight(row?: TrackerDay): number {
  if (!row) return 0
  const v = row.value
  if (v.kind === 'counter') return Math.min(v.count, 6)
  if (v.kind === 'checklist') {
    return Object.values(v.groups)
      .flat()
      .filter((s) => s.trim()).length
  }
  if (v.kind === 'habit') return v.done ? 3 : 0
  if (v.kind === 'scale') return v.value
  return 0
}

export function TrackerScreen() {
  const { trackerId = '' } = useParams()
  const def = getTracker(trackerId)
  const states = useTrackerState()
  const history = useTrackerHistory(trackerId, 28)

  const state = states.find((s) => s.trackerId === trackerId)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [intro, setIntro] = useState('')

  if (!def) {
    return (
      <div className="space-y-4">
        <PageHeader title="Такого листа нет" />
        <Link
          to="/skills"
          className="inline-flex min-h-11 items-center font-form text-body text-violet"
        >
          Вернуться к навыкам
        </Link>
      </div>
    )
  }

  const max = Math.max(1, ...history.map((h) => dayWeight(h.row)))
  const marked = history.filter((h) => dayWeight(h.row) > 0).length

  async function saveCustom() {
    await db.trackerState.put({
      trackerId,
      active: state?.active ?? true,
      startedAt: state?.startedAt ?? Date.now(),
      customTitle: title.trim() || undefined,
      customIntro: intro.trim() || undefined,
    })
    setEditing(false)
  }

  return (
    <div className="space-y-7">
      <PageHeader
        title={state?.customTitle ?? def.title}
        subtitle={def.chapterRef}
        action={
          <Link
            to="/skills"
            className="inline-flex min-h-11 shrink-0 items-center font-form text-form text-pencil hover:text-ink"
          >
            Назад
          </Link>
        }
      />

      <Panel title={format(new Date(), 'd MMMM', { locale: ru })}>
        <TrackerWidget def={def} />
      </Panel>

      <Panel title={`Четыре недели, отмечено ${marked} из 28`}>
        <div
          className="flex items-end gap-[3px]"
          role="img"
          aria-label={`Отмечено дней за четыре недели: ${marked} из 28`}
        >
          {history.map(({ date, row }) => {
            const w = dayWeight(row)
            return (
              <div
                key={date}
                title={format(dayKeyToDate(date), 'd MMMM', { locale: ru })}
                className="flex-1"
                style={{
                  height: `${6 + (w / max) * 38}px`,
                  backgroundColor:
                    w === 0 ? 'var(--color-rule)' : 'var(--color-violet)',
                  opacity: w === 0 ? 1 : 0.4 + (w / max) * 0.6,
                }}
              />
            )
          })}
        </div>
        <p className="mt-3 font-form text-note leading-relaxed text-pencil">
          Пустой день — просто пустой день: поводов отказать или попросить каждый
          день выпадает разное число. Столбики тут не для того, чтобы расти.
        </p>
      </Panel>

      <FromBook source={def.chapterRef}>{state?.customIntro ?? def.intro}</FromBook>

      {editing ? (
        <div className="space-y-4">
          <div>
            <label
              htmlFor="tracker-title"
              className="font-form text-form text-pencil"
            >
              Название листа
            </label>
            <input
              id="tracker-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={def.title}
              className="min-h-11 w-full border-b border-rule-strong bg-transparent font-book text-body text-ink outline-none focus:border-violet"
            />
          </div>
          <div>
            <label
              htmlFor="tracker-intro"
              className="font-form text-form text-pencil"
            >
              Зачем он вам
            </label>
            <TextArea
              id="tracker-intro"
              rows={4}
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              placeholder={def.intro}
            />
          </div>
          <div className="flex items-center gap-4">
            <Button variant="write" onClick={() => void saveCustom()}>
              Сохранить
            </Button>
            <Button
              variant="quiet"
              className="px-0"
              onClick={() => setEditing(false)}
            >
              Отмена
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="quiet"
          className="px-0 text-form"
          onClick={() => {
            setTitle(state?.customTitle ?? '')
            setIntro(state?.customIntro ?? '')
            setEditing(true)
          }}
        >
          Переписать лист под себя
        </Button>
      )}
    </div>
  )
}
