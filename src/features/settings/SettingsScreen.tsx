import { useEffect, useRef, useState } from 'react'
import { PageHeader } from '@/app/Layout'
import { Button, Line, NavRow, Panel, Sheet } from '@/app/ui'
import { useLogCount, useSetting } from '@/db/queries'
import { downloadBackup, importBackup, LAST_BACKUP_KEY } from '@/db/backup'
import type { ImportReport } from '@/db/backup'
import { DEFAULT_SCHEDULE } from '@/reminders/channel'
import type { ReminderSchedule, ReminderStatus } from '@/reminders/channel'
import { webPushChannel } from '@/reminders/webPush'
import { EMOTION_STATS } from '@/content/emotions'
import { withPlural } from '@/lib/plural'

/** Сколько дней без копии считаем поводом подсветить строку. */
const STALE_BACKUP_DAYS = 14
/** Ниже этого числа записей терять почти нечего — не дёргаем. */
const ENOUGH_TO_LOSE = 20

function Backup() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [report, setReport] = useState<ImportReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  const lastBackupAt = useSetting<number | null>(LAST_BACKUP_KEY, null)
  const logCount = useLogCount()

  const daysSince =
    lastBackupAt === null
      ? null
      : Math.floor((Date.now() - lastBackupAt) / 86_400_000)
  const stale =
    logCount >= ENOUGH_TO_LOSE &&
    (daysSince === null || daysSince >= STALE_BACKUP_DAYS)

  const freshness =
    daysSince === null
      ? 'Копию ещё не делали'
      : daysSince === 0
        ? 'Последняя копия — сегодня'
        : `Последняя копия ${withPlural(daysSince, ['день', 'дня', 'дней'])} назад`

  async function onFile(file: File) {
    setError(null)
    setReport(null)
    try {
      setReport(await importBackup(await file.text()))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <Panel title="Резервная копия">
      <p className="font-form text-form leading-relaxed text-pencil">
        Дневник хранится только в этом браузере. Очистка данных сайта сотрёт его —
        выгружайте копию время от времени.
      </p>

      {/* Тихая строка, а не баннер: давить на человека это приложение не должно. */}
      <p
        className={`mt-2 font-form text-note ${stale ? 'text-sepia' : 'text-pencil'}`}
      >
        {freshness}
        {stale && logCount > 0 && `, а записей уже ${logCount}`}
      </p>

      <div className="mt-3 flex gap-3">
        <Button className="flex-1" onClick={() => void downloadBackup()}>
          Выгрузить
        </Button>
        <Button className="flex-1" onClick={() => fileRef.current?.click()}>
          Загрузить
        </Button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void onFile(file)
          e.target.value = ''
        }}
      />

      {report && (
        <p className="mt-3 font-form text-note leading-relaxed text-pencil">
          Добавлено: записей {report.emotionLogs}, разборов {report.iaaaEntries},
          дней в листах {report.trackerDays}, опросников {report.assessments}.
          Существующее не перезаписывалось.
        </p>
      )}
      {error && <p className="mt-3 font-form text-note text-sepia">{error}</p>}
    </Panel>
  )
}

export function SettingsScreen() {
  const schedule = useSetting<ReminderSchedule>(
    'reminderSchedule',
    DEFAULT_SCHEDULE,
  )
  const [status, setStatus] = useState<ReminderStatus>('off')

  useEffect(() => {
    void webPushChannel.status().then(setStatus)
  }, [])

  const reminderHint =
    status === 'on'
      ? `${withPlural(schedule.count, ['раз', 'раза', 'раз'])} в день, случайно между ${schedule.from} и ${schedule.to}`
      : 'Выключены'

  return (
    <div className="space-y-6">
      <PageHeader title="Настройки" />

      <Panel title="Практика">
        <Sheet>
          <NavRow
            to="/settings/reminders"
            title="Напоминания"
            hint={reminderHint}
            note={status === 'on' ? '✓' : null}
          />
          <NavRow
            to="/assessment"
            title="Опросник"
            hint="Пройти или сравнить с прошлым разом"
            note="22"
          />
          <NavRow
            to="/recovery"
            title="Я сбился с практики"
            hint="Что обычно мешает и почему это нормально"
            note="гл. 5"
          />
        </Sheet>
      </Panel>

      <Backup />

      <Panel title="О приложении">
        <Sheet ruled={false}>
          <Line>
            <p className="font-book text-form leading-[1.75] text-pencil">
              Практикум по книге Jonice Webb «Running on Empty», в русском издании —
              «Почти на нуле». Это инструмент для самостоятельной работы: он не
              заменяет ни книгу, ни терапию.
            </p>
            <p className="mt-2 font-form text-note text-pencil">
              В словаре {EMOTION_STATS.words} слов, разложенных по{' '}
              {EMOTION_STATS.categories} группам.
            </p>
          </Line>
        </Sheet>
      </Panel>
    </div>
  )
}
