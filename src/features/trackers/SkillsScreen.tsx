import { useState } from 'react'
import { Link } from 'react-router'
import { PageHeader } from '@/app/Layout'
import { Button, FromBook, Panel } from '@/app/ui'
import {
  ACTIVE_LIMIT_EXPLANATION,
  MAX_ACTIVE_TRACKERS,
  TRACKERS,
} from '@/content/trackers'
import { setTrackerActive, useTrackerState } from '@/db/queries'

export function SkillsScreen() {
  const states = useTrackerState()
  const [limitHit, setLimitHit] = useState(false)

  const byId = new Map(states.map((s) => [s.trackerId, s]))
  const activeCount = states.filter((s) => s.active).length

  async function toggle(trackerId: string, next: boolean) {
    const ok = await setTrackerActive(trackerId, next)
    setLimitHit(!ok)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Навыки"
        subtitle={`Начато ${activeCount} из ${MAX_ACTIVE_TRACKERS} возможных`}
      />

      {limitHit && <FromBook source="Глава 7">{ACTIVE_LIMIT_EXPLANATION}</FromBook>}

      {TRACKERS.map((def) => {
        const state = byId.get(def.id)
        const active = state?.active ?? false

        return (
          // Номер в названии графы — порядок освоения из книги, а не украшение.
          <Panel
            key={def.id}
            title={`${def.order}. ${state?.customTitle ?? def.title}`}
            className={active ? 'border-violet' : undefined}
          >
            <p className="font-form text-note text-pencil">{def.chapterRef}</p>

            <p className="mt-2 font-book text-form leading-[1.7] text-pencil">
              {state?.customIntro ?? def.intro}
            </p>

            <div className="mt-3 flex items-center gap-4">
              {def.implemented ? (
                <>
                  <Button
                    variant={active ? 'plain' : 'write'}
                    onClick={() => void toggle(def.id, !active)}
                  >
                    {active ? 'Отложить' : 'Начать вести'}
                  </Button>
                  {active && (
                    <Link
                      to={`/skills/${def.id}`}
                      className="inline-flex min-h-11 items-center font-form text-form text-pencil hover:text-ink"
                    >
                      Открыть лист
                    </Link>
                  )}
                </>
              ) : (
                <span className="font-form text-form text-pencil">
                  Появится в следующей версии
                </span>
              )}
            </div>
          </Panel>
        )
      })}
    </div>
  )
}
