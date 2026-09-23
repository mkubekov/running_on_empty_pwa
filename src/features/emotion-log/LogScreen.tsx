import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { PageHeader } from '@/app/Layout'
import { Button, FromBook, Line, Panel, Sheet, TextArea } from '@/app/ui'
import { EmotionPicker } from '@/features/emotion-picker/EmotionPicker'
import { NAMING_STEPS, NAMING_NOTE } from '@/content/namingExercise'
import { CAUSE_QUESTIONS } from '@/content/causeQuestions'
import { deleteLog, saveLog, updateLog, useLog } from '@/db/queries'
import { timeInputValue, timestampFromTime } from '@/lib/date'
import type { EmotionId } from '@/content/emotions'

/**
 * Свёрнут по умолчанию: подсказка нужна первые разы, а не каждый вечер.
 * Шаги пронумерованы, потому что это действительно последовательность.
 */
function HowTo() {
  const [open, setOpen] = useState(false)
  return (
    <Panel title="Как это делать">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
      >
        <span className="font-form text-form text-pencil">
          Упражнение из главы 6
        </span>
        <span className="shrink-0 font-form text-form text-violet">
          {open ? 'свернуть' : 'шесть шагов'}
        </span>
      </button>

      {open && (
        <div className="mt-2 space-y-4">
          <Sheet>
            {NAMING_STEPS.map((step) => (
              <Line key={step.n} note={String(step.n)}>
                <p className="font-book text-body leading-snug">{step.title}</p>
                <p className="mt-1 font-form text-form leading-snug text-pencil">
                  {step.hint}
                </p>
              </Line>
            ))}
          </Sheet>
          <FromBook>{NAMING_NOTE}</FromBook>
        </div>
      )}
    </Panel>
  )
}

export function LogScreen() {
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const editId = params.get('edit') ? Number(params.get('edit')) : undefined
  const editing = editId !== undefined
  const existing = useLog(editId)

  const [time, setTime] = useState(() => timeInputValue())
  const [emotionIds, setEmotionIds] = useState<EmotionId[]>([])
  const [cause, setCause] = useState('')
  const [bodyNote, setBodyNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Заполняем форму один раз, когда запись доехала из базы: иначе живой запрос
  // затирал бы то, что человек уже успел поправить.
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    if (!existing || loaded) return
    setTime(timeInputValue(new Date(existing.at)))
    setEmotionIds(existing.emotionIds)
    setCause(existing.cause)
    setBodyNote(existing.bodyNote)
    setLoaded(true)
  }, [existing, loaded])

  async function save() {
    if (emotionIds.length === 0 || saving) return
    setSaving(true)
    const at = timestampFromTime(time, existing ? new Date(existing.at) : undefined)

    if (editing && editId !== undefined) {
      await updateLog(editId, { emotionIds, cause, bodyNote, at })
      navigate(-1)
      return
    }

    const id = await saveLog({ emotionIds, cause, bodyNote, at })
    navigate(`/?saved=${id}`, { replace: true })
  }

  async function remove() {
    if (editId === undefined || saving) return
    // Подтверждение вторым нажатием, а не confirm(): браузерный диалог
    // блокирует service worker, и после него перестают ходить уведомления.
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setSaving(true)
    await deleteLog(editId)
    navigate('/history/entries', { replace: true })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={editing ? 'Исправить запись' : 'Что я чувствую'}
        action={
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex min-h-11 shrink-0 items-center font-form text-form text-pencil hover:text-ink"
          >
            Отмена
          </button>
        }
      />

      <Panel title="Время">
        <div className="flex items-center gap-4">
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            aria-label="Время записи"
            className="min-h-11 w-full max-w-[9rem] border-b border-rule-strong bg-transparent font-form text-word text-ink tabular-nums outline-none focus:border-violet"
          />
          <span className="font-form text-note leading-snug text-pencil">
            поправьте, если записываете задним числом
          </span>
        </div>
      </Panel>

      <HowTo />

      <Panel title="Слово">
        <EmotionPicker value={emotionIds} onChange={setEmotionIds} />
      </Panel>

      {emotionIds.length > 0 && (
        <Panel title="Почему я это чувствую">
          <TextArea
            id="cause"
            rows={4}
            value={cause}
            onChange={(e) => setCause(e.target.value)}
            aria-label="Почему я это чувствую"
            placeholder="Можно не отвечать сразу — причина часто находится позже"
          />

          <div className="mt-3 flex flex-col gap-1">
            {CAUSE_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setCause((c) => (c ? `${c}\n\n${q}\n` : `${q}\n`))}
                className="py-1 text-left font-form text-note leading-snug text-pencil hover:text-ink"
              >
                {q}
              </button>
            ))}
          </div>

          <div className="mt-4">
            <label htmlFor="body" className="font-form text-form text-pencil">
              Где отзывается в теле
            </label>
            <TextArea
              id="body"
              rows={2}
              value={bodyNote}
              onChange={(e) => setBodyNote(e.target.value)}
              placeholder="Необязательно"
            />
          </div>
        </Panel>
      )}

      <Button
        variant="write"
        className="w-full"
        disabled={emotionIds.length === 0 || saving}
        onClick={save}
      >
        {emotionIds.length === 0
          ? 'Выберите хотя бы одно слово'
          : editing
            ? 'Сохранить изменения'
            : 'Сохранить запись'}
      </Button>

      {editing && (
        <div className="space-y-2">
          <Button
            variant="quiet"
            className={`w-full px-0 ${confirmDelete ? 'text-sepia' : ''}`}
            disabled={saving}
            onClick={remove}
          >
            {confirmDelete ? 'Нажмите ещё раз, чтобы удалить' : 'Удалить запись'}
          </Button>
          {confirmDelete && (
            <Button
              variant="quiet"
              className="w-full px-0"
              onClick={() => setConfirmDelete(false)}
            >
              Не удалять
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
