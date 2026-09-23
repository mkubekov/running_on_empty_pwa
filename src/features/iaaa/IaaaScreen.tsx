import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router'
import { PageHeader } from '@/app/Layout'
import { Button, FromBook, Line, Panel, Sheet, TextArea } from '@/app/ui'
import { EmotionPicker } from '@/features/emotion-picker/EmotionPicker'
import { IAAA_STEPS, EMOTION_RULES, ASSERTIVE_NOTE } from '@/content/iaaa'
import { emotionWords } from '@/content/emotions'
import type { EmotionId } from '@/content/emotions'
import { db } from '@/db/schema'
import type { IaaaEntry } from '@/db/schema'
import { dayKey } from '@/lib/date'

export function IaaaScreen() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const logId = params.get('logId') ? Number(params.get('logId')) : undefined

  const [step, setStep] = useState(0)
  const [emotionIds, setEmotionIds] = useState<EmotionId[]>([])
  const [accepted, setAccepted] = useState(false)
  const [attribution, setAttribution] = useState('')
  const [application, setApplication] = useState('')
  const [saving, setSaving] = useState(false)

  // Если разбор запущен из записи — не заставляем выбирать слова заново.
  useEffect(() => {
    if (logId === undefined) return
    void db.emotionLogs.get(logId).then((log) => {
      if (!log) return
      setEmotionIds(log.emotionIds)
      if (log.cause) setAttribution((a) => a || log.cause)
      setStep(1)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logId])

  const current = IAAA_STEPS[step]
  const canAdvance =
    (step === 0 && emotionIds.length > 0) || (step === 1 && accepted) || step >= 2

  async function finish(state: 0 | 1 | 2) {
    if (saving) return
    setSaving(true)
    const at = Date.now()
    await db.iaaaEntries.add({
      logId,
      at,
      date: dayKey(new Date(at)),
      emotionIds,
      accepted,
      attribution,
      application,
      applicationState: state,
    } as IaaaEntry)
    navigate('/', { replace: true })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Разбор чувства"
        subtitle="Идентифицируй, прими, припиши, примени"
        action={
          <Link
            to="/"
            className="inline-flex min-h-11 shrink-0 items-center font-form text-form text-pencil hover:text-ink"
          >
            Закрыть
          </Link>
        }
      />

      {/* Четыре буквы вместо полоски прогресса: они же и есть название метода. */}
      <div className="flex gap-2">
        {IAAA_STEPS.map((s, i) => (
          <div
            key={s.id}
            aria-hidden
            className={`flex-1 border-t-2 pt-2 font-book text-body transition-colors ${
              i === step
                ? 'border-violet text-violet'
                : i < step
                  ? 'border-violet/40 text-pencil'
                  : 'border-rule text-pencil-faint'
            }`}
          >
            {s.letter}
          </div>
        ))}
      </div>

      <Panel title={`Шаг ${step + 1} из 4`}>
        <h2 className="font-book text-head leading-tight">{current.title}</h2>
        <p className="mt-2 font-book text-body leading-[1.7] text-pencil">
          {current.lead}
        </p>
        <ul className="mt-3 space-y-1">
          {current.prompts.map((p) => (
            <li key={p} className="font-form text-form leading-snug text-pencil">
              {p}
            </li>
          ))}
        </ul>
      </Panel>

      {step > 0 && emotionIds.length > 0 && (
        <p className="font-book text-word leading-snug">
          {emotionWords(emotionIds).join(', ')}
        </p>
      )}

      {step === 0 && (
        <Panel title="Слово">
          <EmotionPicker value={emotionIds} onChange={setEmotionIds} />
        </Panel>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <Panel title="Три правила об эмоциях">
            <Sheet>
              {EMOTION_RULES.map((rule, i) => (
                <Line key={rule.title} note={String(i + 1)}>
                  <p className="font-book text-body leading-snug">{rule.title}</p>
                  <p className="mt-1 font-form text-form leading-relaxed text-pencil">
                    {rule.body}
                  </p>
                </Line>
              ))}
            </Sheet>
          </Panel>

          <button
            type="button"
            onClick={() => setAccepted(!accepted)}
            aria-pressed={accepted}
            className={`flex min-h-12 w-full items-center gap-3 border px-4 text-left font-book text-body transition-colors ${
              accepted
                ? 'border-violet bg-violet-wash text-violet'
                : 'border-rule-strong text-pencil hover:border-pencil hover:text-ink'
            }`}
          >
            <span aria-hidden className="w-4 shrink-0 text-center">
              {accepted ? '✓' : ''}
            </span>
            Я не считаю это чувство плохим
          </button>
        </div>
      )}

      {step === 2 && (
        <Panel title="К чему это относится">
          <TextArea
            rows={6}
            value={attribution}
            onChange={(e) => setAttribution(e.target.value)}
            aria-label="К чему относится это чувство"
            placeholder="К чему это относится? Что оно пытается сказать?"
          />
        </Panel>
      )}

      {step === 3 && (
        <Panel title="Что с этим делать" className="space-y-5">
          <TextArea
            rows={5}
            value={application}
            onChange={(e) => setApplication(e.target.value)}
            aria-label="К какому действию зовёт чувство"
            placeholder="Что это чувство просит сделать? Кому и как сказать?"
          />
          <FromBook source="Глава 6">{ASSERTIVE_NOTE}</FromBook>
        </Panel>
      )}

      {step < 3 ? (
        <div className="flex items-center gap-4">
          {step > 0 && (
            <Button
              variant="quiet"
              className="px-0"
              onClick={() => setStep(step - 1)}
            >
              Назад
            </Button>
          )}
          <Button
            variant="write"
            className="flex-1"
            disabled={!canAdvance}
            onClick={() => setStep(step + 1)}
          >
            Дальше
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Button
            variant="write"
            className="w-full"
            disabled={saving || !application.trim()}
            onClick={() => finish(1)}
          >
            Наметить действие
          </Button>
          <div className="flex items-center gap-4">
            <Button variant="quiet" className="px-0" onClick={() => setStep(2)}>
              Назад
            </Button>
            <Button
              variant="quiet"
              className="px-0"
              disabled={saving}
              onClick={() => finish(0)}
            >
              Здесь ничего делать не нужно
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
