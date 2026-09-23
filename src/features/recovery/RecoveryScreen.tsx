import { Link } from 'react-router'
import { PageHeader } from '@/app/Layout'
import { Button, Line, Panel, Sheet } from '@/app/ui'
import {
  CHANGE_BLOCKERS,
  RECOVERY_CTA,
  SELF_ANGER_WARNING,
} from '@/content/changeBlockers'

/**
 * Экран, на который человек попадает, когда бросил практику.
 * Здесь нет ни одной цифры о пропусках и ни одного упрёка — это принципиально:
 * автор прямо называет злость на себя главным врагом изменений.
 */
export function RecoveryScreen() {
  return (
    <div className="space-y-7">
      <PageHeader
        title="Сбиться — часть процесса"
        subtitle="Глава 5, как происходят изменения"
      />

      <p className="font-book text-word leading-[1.6]">
        Вы здесь не потому, что провалились. Помешать может только одно — решение
        бросить совсем.
      </p>

      <p className="border-l-2 border-sepia pl-4 font-book text-body leading-[1.7] text-sepia">
        {SELF_ANGER_WARNING}
      </p>

      <Panel title="Что обычно мешает">
        <Sheet>
          {CHANGE_BLOCKERS.map((blocker, i) => (
            <Line key={blocker.id} note={String(i + 1)}>
              <h2 className="font-book text-word leading-snug">{blocker.title}</h2>
              <p className="mt-1.5 font-book text-form leading-[1.75] text-pencil">
                {blocker.body}
              </p>
            </Line>
          ))}
        </Sheet>
      </Panel>

      <Link to="/" className="block">
        <Button variant="write" className="w-full">
          {RECOVERY_CTA}
        </Button>
      </Link>

      <p className="font-form text-note leading-relaxed text-pencil-faint">
        Ничего не обнулилось. Всё, что вы записали раньше, на месте.
      </p>
    </div>
  )
}
