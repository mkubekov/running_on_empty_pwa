import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { PageHeader } from '@/app/Layout'
import { Button, Line, Panel, Sheet } from '@/app/ui'
import { setSetting, useSetting } from '@/db/queries'
import {
  DEFAULT_SCHEDULE,
  GAP_CHOICES,
  isScheduleValid,
  MAX_REMINDERS_PER_DAY,
  maxCountFor,
  minutesOf,
} from '@/reminders/channel'
import type {
  ReminderSchedule,
  ReminderStatus,
  ReminderTime,
} from '@/reminders/channel'
import { webPushChannel } from '@/reminders/webPush'

const STATUS_TEXT: Record<ReminderStatus, string> = {
  on: 'Приходят',
  off: 'Выключены',
  denied: 'Браузер запретил уведомления. Разрешите их в настройках сайта',
  unsupported: 'Этот браузер не умеет push-уведомления',
  unconfigured:
    'Не задан VITE_VAPID_PUBLIC_KEY: работают только в развёрнутой версии',
  error: 'Не удалось проверить состояние',
}

/** «90 мин» читается как «1.5 часа» только у калькулятора. Пишем по-человечески. */
function gapLabel(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} мин`
  const hours = h === 1 ? '1 час' : h < 5 ? `${h} часа` : `${h} часов`
  return m === 0 ? hours : `${h} ч ${m} м`
}

/** Кнопки в ряд: выбор одного значения из нескольких. */
function Choice<T extends string | number>({
  options,
  value,
  onPick,
  label,
  disabled,
}: {
  options: readonly { value: T; text: string; enabled?: boolean }[]
  value: T
  onPick: (v: T) => void
  label: string
  disabled?: boolean
}) {
  return (
    <div className="flex gap-1.5">
      {options.map((o) => {
        const off = o.enabled === false || disabled
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={value === o.value}
            aria-label={`${label}: ${o.text}`}
            disabled={off}
            onClick={() => onPick(o.value)}
            className={`min-h-11 min-w-0 flex-1 border px-1 font-form text-form tabular-nums transition-colors ${
              value === o.value
                ? 'border-violet bg-violet-wash text-violet'
                : off
                  ? 'border-rule text-pencil-faint opacity-40'
                  : 'border-rule text-pencil hover:border-pencil hover:text-ink'
            }`}
          >
            {o.text}
          </button>
        )
      })}
    </div>
  )
}

export function RemindersScreen() {
  const schedule = useSetting<ReminderSchedule>(
    'reminderSchedule',
    DEFAULT_SCHEDULE,
  )
  const [status, setStatus] = useState<ReminderStatus>('off')
  const [plan, setPlan] = useState<ReminderTime[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentNow, setSentNow] = useState(false)

  useEffect(() => {
    void (async () => {
      const s = await webPushChannel.status()
      setStatus(s)
      if (s === 'on') setPlan(await webPushChannel.todayPlan().catch(() => []))
    })()
  }, [])

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      const s = await webPushChannel.status()
      setStatus(s)
      setPlan(s === 'on' ? await webPushChannel.todayPlan().catch(() => []) : [])
      setBusy(false)
    }
  }

  /** Меняем окно так, чтобы оно всегда оставалось выполнимым. */
  async function change(patch: Partial<ReminderSchedule>) {
    const next: ReminderSchedule = { ...schedule, ...patch }
    // Уменьшили окно или увеличили промежуток — столько раз уже не влезет.
    next.count = Math.min(next.count, maxCountFor(next))
    if (!isScheduleValid(next)) return
    await setSetting('reminderSchedule', next)
    if (status === 'on') {
      await run(async () => {
        await webPushChannel.updateSchedule(next)
      })
    }
  }

  const fits = maxCountFor(schedule)
  const windowBroken = minutesOf(schedule.to) <= minutesOf(schedule.from)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Напоминания"
        subtitle={STATUS_TEXT[status]}
        action={
          <Link
            to="/settings"
            className="inline-flex min-h-11 shrink-0 items-center font-form text-form text-pencil hover:text-ink"
          >
            Назад
          </Link>
        }
      />

      <Panel title="Когда">
        <Sheet>
          <Line note="с">
            <input
              type="time"
              value={schedule.from}
              aria-label="Начало окна"
              onChange={(e) => void change({ from: e.target.value })}
              className="min-h-11 w-full max-w-[9rem] border-b border-rule-strong bg-transparent font-form text-word text-ink tabular-nums outline-none focus:border-violet"
            />
          </Line>
          <Line note="до">
            <input
              type="time"
              value={schedule.to}
              aria-label="Конец окна"
              onChange={(e) => void change({ to: e.target.value })}
              className="min-h-11 w-full max-w-[9rem] border-b border-rule-strong bg-transparent font-form text-word text-ink tabular-nums outline-none focus:border-violet"
            />
          </Line>
        </Sheet>
        {windowBroken && (
          <p className="mt-2 font-form text-note text-sepia">
            Конец окна должен быть позже начала.
          </p>
        )}
      </Panel>

      <Panel title="Сколько раз в день">
        <Choice
          label="Раз в день"
          value={schedule.count}
          onPick={(count) => void change({ count })}
          options={Array.from({ length: MAX_REMINDERS_PER_DAY }, (_, i) => ({
            value: i + 1,
            text: String(i + 1),
            enabled: i + 1 <= fits,
          }))}
        />
        <p className="mt-2.5 font-form text-note leading-snug text-pencil">
          {fits < MAX_REMINDERS_PER_DAY
            ? `В это окно с таким промежутком помещается не больше ${fits}.`
            : 'В книге — трижды в день. Ставьте столько, сколько реально выдержите.'}
        </p>
      </Panel>

      <Panel title="Не чаще чем раз в">
        <Choice
          label="Промежуток"
          value={schedule.minGapMinutes}
          onPick={(minGapMinutes) => void change({ minGapMinutes })}
          options={GAP_CHOICES.map((g) => ({ value: g, text: gapLabel(g) }))}
        />
        <p className="mt-2.5 font-form text-note leading-snug text-pencil">
          Время выбирается случайно и каждый день заново — так напоминание не
          превращается в будильник, который перестаёшь замечать. Промежуток нужен,
          чтобы случайность не слепила два подряд.
        </p>
      </Panel>

      {status === 'on' && plan.length > 0 && (
        <Panel title="Сегодня придут">
          <Sheet>
            {plan.map((time, i) => (
              <Line key={time} note={String(i + 1)}>
                <span className="font-form text-word tabular-nums">{time}</span>
              </Line>
            ))}
          </Sheet>
          <p className="mt-2.5 font-form text-note leading-snug text-pencil">
            Завтра будут другие.
          </p>
        </Panel>
      )}

      <Panel title="Доставка">
        {status === 'on' || status === 'off' ? (
          <>
            <Button
              variant={status === 'on' ? 'plain' : 'write'}
              className="w-full"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  if (status === 'on') await webPushChannel.disable()
                  else await webPushChannel.enable(schedule)
                })
              }
            >
              {status === 'on' ? 'Выключить напоминания' : 'Включить напоминания'}
            </Button>

            {status === 'on' && (
              <Button
                variant="quiet"
                className="mt-2 w-full px-0"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await webPushChannel.test()
                    setSentNow(true)
                    setTimeout(() => setSentNow(false), 4000)
                  })
                }
              >
                {sentNow ? 'Отправлено' : 'Прислать уведомление сейчас'}
              </Button>
            )}
          </>
        ) : (
          // Без кнопки графа выглядела бы пустой и сломанной: объясняем, что не так.
          <p className="font-form text-form leading-relaxed text-pencil">
            {STATUS_TEXT[status]}. Окно и частоту можно настроить уже сейчас — они
            сохранятся и применятся, как только доставка заработает.
          </p>
        )}

        {error && <p className="mt-2 font-form text-note text-sepia">{error}</p>}

        <p className="mt-3 font-form text-note leading-relaxed text-pencil">
          На сервер уходит только адрес доставки и это окно. Записи остаются на
          телефоне: уведомление приходит пустым, текст к нему подбирается уже здесь.
        </p>
      </Panel>
    </div>
  )
}
