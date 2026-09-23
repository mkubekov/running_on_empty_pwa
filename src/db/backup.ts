import { db, SCHEMA_VERSION } from './schema'
import type {
  Assessment,
  EmotionLog,
  IaaaEntry,
  PrefEntry,
  SettingRow,
  TrackerDay,
  TrackerState,
} from './schema'
import { format } from 'date-fns'

export interface Backup {
  app: 'running-on-empty'
  schemaVersion: number
  exportedAt: string
  emotionLogs: EmotionLog[]
  iaaaEntries: IaaaEntry[]
  trackerDays: TrackerDay[]
  trackerState: TrackerState[]
  assessments: Assessment[]
  prefs: PrefEntry[]
  settings: SettingRow[]
}

export async function buildBackup(): Promise<Backup> {
  const [
    emotionLogs,
    iaaaEntries,
    trackerDays,
    trackerState,
    assessments,
    prefs,
    settings,
  ] = await Promise.all([
    db.emotionLogs.toArray(),
    db.iaaaEntries.toArray(),
    db.trackerDays.toArray(),
    db.trackerState.toArray(),
    db.assessments.toArray(),
    db.prefs.toArray(),
    db.settings.toArray(),
  ])

  return {
    app: 'running-on-empty',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    emotionLogs,
    iaaaEntries,
    trackerDays,
    trackerState,
    assessments,
    prefs,
    settings,
  }
}

/** Ключ настройки с датой последней выгрузки. */
export const LAST_BACKUP_KEY = 'lastBackupAt'

export async function downloadBackup() {
  const backup = await buildBackup()
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `pochti-na-nule-${format(new Date(), 'yyyy-MM-dd')}.json`
  a.click()
  URL.revokeObjectURL(url)

  await db.settings.put({ key: LAST_BACKUP_KEY, value: Date.now() })
}

export interface ImportReport {
  emotionLogs: number
  iaaaEntries: number
  trackerDays: number
  assessments: number
  prefs: number
}

function isBackup(value: unknown): value is Backup {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return v.app === 'running-on-empty' && typeof v.schemaVersion === 'number'
}

/**
 * Слияние, а не замена: восстановление на другом устройстве не должно стирать
 * то, что уже там записано. Дедупликация журнальных записей — по времени
 * события, у дневных строк — по составному ключу.
 */
export async function importBackup(raw: string): Promise<ImportReport> {
  const parsed: unknown = JSON.parse(raw)
  if (!isBackup(parsed)) {
    throw new Error('Это не файл резервной копии приложения.')
  }
  if (parsed.schemaVersion > SCHEMA_VERSION) {
    throw new Error(
      `Копия сделана более новой версией приложения (схема ${parsed.schemaVersion}). Обновите приложение.`,
    )
  }

  const report: ImportReport = {
    emotionLogs: 0,
    iaaaEntries: 0,
    trackerDays: 0,
    assessments: 0,
    prefs: 0,
  }

  await db.transaction(
    'rw',
    [
      'emotionLogs',
      'iaaaEntries',
      'trackerDays',
      'trackerState',
      'assessments',
      'prefs',
      'settings',
    ],
    async () => {
      const existingLogAt = new Set(
        (await db.emotionLogs.toArray()).map((l) => l.at),
      )
      for (const log of parsed.emotionLogs ?? []) {
        if (existingLogAt.has(log.at)) continue
        const { id: _id, ...rest } = log
        await db.emotionLogs.add(rest as EmotionLog)
        report.emotionLogs++
      }

      const existingIaaaAt = new Set(
        (await db.iaaaEntries.toArray()).map((e) => e.at),
      )
      for (const entry of parsed.iaaaEntries ?? []) {
        if (existingIaaaAt.has(entry.at)) continue
        const { id: _id, logId: _logId, ...rest } = entry
        await db.iaaaEntries.add(rest as IaaaEntry)
        report.iaaaEntries++
      }

      for (const row of parsed.trackerDays ?? []) {
        const current = await db.trackerDays.get([row.trackerId, row.date])
        if (current && current.updatedAt >= row.updatedAt) continue
        await db.trackerDays.put(row)
        report.trackerDays++
      }

      for (const state of parsed.trackerState ?? []) {
        if (await db.trackerState.get(state.trackerId)) continue
        await db.trackerState.put(state)
      }

      const existingAssessAt = new Set(
        (await db.assessments.toArray()).map((a) => a.at),
      )
      for (const a of parsed.assessments ?? []) {
        if (existingAssessAt.has(a.at)) continue
        const { id: _id, ...rest } = a
        await db.assessments.add(rest as Assessment)
        report.assessments++
      }

      const existingPrefs = new Set(
        (await db.prefs.toArray()).map(
          (p) => `${p.trackerId}|${p.bucket}|${p.text}`,
        ),
      )
      for (const p of parsed.prefs ?? []) {
        if (existingPrefs.has(`${p.trackerId}|${p.bucket}|${p.text}`)) continue
        const { id: _id, ...rest } = p
        await db.prefs.add(rest as PrefEntry)
        report.prefs++
      }

      for (const s of parsed.settings ?? []) {
        if (await db.settings.get(s.key)) continue
        await db.settings.put(s)
      }
    },
  )

  return report
}
