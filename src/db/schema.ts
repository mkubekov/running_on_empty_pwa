import Dexie from 'dexie'
import type { EntityTable, Table } from 'dexie'
import type { EmotionId } from '@/content/emotions'

/** Календарный день в локальной зоне, формат YYYY-MM-DD. Ключ для всего дневного. */
export type DayKey = string

export interface EmotionLog {
  id: number
  date: DayKey
  /** Момент записи. Никаких слотов дня — человек фиксирует время, и всё. */
  at: number
  emotionIds: EmotionId[]
  /** «Почему я это чувствую» — свободный текст. */
  cause: string
  /** Где в теле отзывается; в книге эмоции часто уходят в тело. */
  bodyNote: string
}

export interface IaaaEntry {
  id: number
  /** Запись листа эмоций, из которой запустили разбор, если она была. */
  logId?: number
  at: number
  date: DayKey
  emotionIds: EmotionId[]
  accepted: boolean
  attribution: string
  application: string
  /** 0 — нечего делать, 1 — намечено, 2 — сделано. */
  applicationState: 0 | 1 | 2
}

export type TrackerValue =
  | { kind: 'counter'; count: number }
  | { kind: 'checklist'; groups: Record<string, string[]> }
  | { kind: 'scale'; value: number }
  | { kind: 'habit'; done: boolean }

export interface TrackerDay {
  trackerId: string
  date: DayKey
  value: TrackerValue
  note: string
  updatedAt: number
}

export interface TrackerState {
  trackerId: string
  active: boolean
  startedAt: number
  /** Автор просит адаптировать листы под себя — поэтому заголовок правится. */
  customTitle?: string
  customIntro?: string
}

export interface Assessment {
  id: number
  at: number
  /** Индекс = номер пункта минус один. */
  answers: boolean[]
}

export interface PrefEntry {
  id: number
  trackerId: string
  bucket: string
  text: string
  createdAt: number
}

export interface SettingRow {
  key: string
  value: unknown
}

/** Составной ключ trackerDays: [trackerId, date]. */
export type TrackerDayKey = [string, DayKey]

const db = new Dexie('running-on-empty') as Dexie & {
  emotionLogs: EntityTable<EmotionLog, 'id'>
  iaaaEntries: EntityTable<IaaaEntry, 'id'>
  trackerDays: Table<TrackerDay, TrackerDayKey, TrackerDay>
  trackerState: EntityTable<TrackerState, 'trackerId'>
  assessments: EntityTable<Assessment, 'id'>
  prefs: EntityTable<PrefEntry, 'id'>
  settings: EntityTable<SettingRow, 'key'>
}

db.version(1).stores({
  emotionLogs: '++id, date, slot, at, *emotionIds',
  iaaaEntries: '++id, logId, date, at, applicationState',
  trackerDays: '[trackerId+date], trackerId, date',
  trackerState: 'trackerId, active',
  assessments: '++id, at',
  prefs: '++id, [trackerId+bucket], createdAt',
  settings: 'key',
})

// Версия 2: слоты «утро/день/вечер» убраны, запись привязана только ко времени.
db.version(2)
  .stores({
    emotionLogs: '++id, date, at, *emotionIds',
    iaaaEntries: '++id, logId, date, at, applicationState',
    trackerDays: '[trackerId+date], trackerId, date',
    trackerState: 'trackerId, active',
    assessments: '++id, at',
    prefs: '++id, [trackerId+bucket], createdAt',
    settings: 'key',
  })
  .upgrade((tx) =>
    tx
      .table('emotionLogs')
      .toCollection()
      .modify((log: Record<string, unknown>) => {
        delete log.slot
      }),
  )

export { db }

export const SCHEMA_VERSION = 2
