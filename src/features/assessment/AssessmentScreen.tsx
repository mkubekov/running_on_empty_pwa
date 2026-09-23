import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useLiveQuery } from 'dexie-react-hooks'
import { PageHeader } from '@/app/Layout'
import { Button, FromBook, Line, Panel, Sheet } from '@/app/ui'
import {
  QUESTIONNAIRE,
  QUESTIONNAIRE_INTRO,
  QUESTIONNAIRE_OUTRO,
} from '@/content/questionnaire'
import { db } from '@/db/schema'
import type { Assessment } from '@/db/schema'

function Result({
  assessment,
  previous,
}: {
  assessment: Assessment
  previous?: Assessment
}) {
  const marked = QUESTIONNAIRE.filter((q) => assessment.answers[q.id - 1])
  const prevCount = previous?.answers.filter(Boolean).length

  return (
    <div className="space-y-6">
      <p className="font-book text-word leading-snug">
        Отмечено {marked.length} из {QUESTIONNAIRE.length}.
        {prevCount !== undefined && previous && (
          <span className="text-pencil">
            {' '}
            В прошлый раз,{' '}
            {format(new Date(previous.at), 'd MMMM yyyy', { locale: ru })}, было{' '}
            {prevCount}.
          </span>
        )}
      </p>

      <FromBook source="Начало книги">{QUESTIONNAIRE_OUTRO}</FromBook>

      {marked.length > 0 && (
        <Panel title="К чему стоит вернуться">
          <Sheet>
            {marked.map((q) => (
              <Line key={q.id} note={String(q.id)}>
                <p className="font-book text-form leading-[1.7] text-pencil">
                  {q.text}
                </p>
              </Line>
            ))}
          </Sheet>
        </Panel>
      )}
    </div>
  )
}

export function AssessmentScreen() {
  const navigate = useNavigate()
  const history = useLiveQuery(() => db.assessments.orderBy('at').toArray(), [], [])
  const [answers, setAnswers] = useState<boolean[]>(
    () => Array(QUESTIONNAIRE.length).fill(false) as boolean[],
  )
  const [mode, setMode] = useState<'intro' | 'filling'>('intro')
  const [saving, setSaving] = useState(false)

  const last = history.at(-1)
  const previous = history.at(-2)

  async function save() {
    if (saving) return
    setSaving(true)
    await db.assessments.add({ at: Date.now(), answers } as Assessment)
    setMode('intro')
    setSaving(false)
  }

  if (mode === 'intro') {
    return (
      <div className="space-y-7">
        <PageHeader
          title="Опросник"
          subtitle="Эмоциональное игнорирование"
          action={
            <Link
              to="/settings"
              className="inline-flex min-h-11 shrink-0 items-center font-form text-form text-pencil hover:text-ink"
            >
              Назад
            </Link>
          }
        />

        <FromBook source="Начало книги">{QUESTIONNAIRE_INTRO}</FromBook>

        {last && <Result assessment={last} previous={previous} />}

        <Button
          variant="write"
          className="w-full"
          onClick={() => {
            setAnswers(Array(QUESTIONNAIRE.length).fill(false) as boolean[])
            setMode('filling')
          }}
        >
          {last ? 'Пройти заново' : 'Пройти опросник'}
        </Button>
      </div>
    )
  }

  const marked = answers.filter(Boolean).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Опросник"
        subtitle={`Отмечено ${marked} из ${QUESTIONNAIRE.length}`}
        action={
          <button
            type="button"
            onClick={() => setMode('intro')}
            className="inline-flex min-h-11 shrink-0 items-center font-form text-form text-pencil hover:text-ink"
          >
            Отмена
          </button>
        }
      />

      <Panel title="Бывает ли, что вы">
        <Sheet>
          {QUESTIONNAIRE.map((q) => {
            const checked = answers[q.id - 1]
            return (
              <Line
                key={q.id}
                note={
                  <span className={checked ? 'text-violet' : undefined}>
                    {checked ? '✓' : q.id}
                  </span>
                }
              >
                <button
                  type="button"
                  aria-pressed={checked}
                  onClick={() =>
                    setAnswers((prev) => {
                      const next = [...prev]
                      next[q.id - 1] = !next[q.id - 1]
                      return next
                    })
                  }
                  className={`flex min-h-11 w-full items-center py-1 text-left font-book text-body leading-snug transition-colors ${
                    checked ? 'text-ink' : 'text-pencil hover:text-ink'
                  }`}
                >
                  {q.text}
                </button>
              </Line>
            )
          })}
        </Sheet>
      </Panel>

      <Button variant="write" className="w-full" disabled={saving} onClick={save}>
        Сохранить результат
      </Button>
      <Button variant="quiet" className="w-full px-0" onClick={() => navigate('/')}>
        Не сейчас
      </Button>
    </div>
  )
}
