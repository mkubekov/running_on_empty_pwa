import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './schema'
import type { DayKey, EmotionLog, TrackerDay, TrackerValue } from './schema'
import { dayKey, lastNDays } from '@/lib/date'
import { getCategory, resolveEmotion } from '@/content/emotions'
import type { EmotionId, Valence } from '@/content/emotions'
import { MAX_ACTIVE_TRACKERS } from '@/content/trackers'

/* ── Лист эмоций ─────────────────────────────────────────────────────────── */

export function useLogsForDay(date: DayKey = dayKey()) {
  return useLiveQuery(
    () => db.emotionLogs.where('date').equals(date).sortBy('at'),
    [date],
    [] as EmotionLog[],
  )
}

export function useLogsInRange(days: number) {
  const keys = lastNDays(days)
  return useLiveQuery(
    () =>
      db.emotionLogs
        .where('date')
        .between(keys[0], keys[keys.length - 1], true, true)
        .sortBy('at'),
    [keys[0], keys[keys.length - 1]],
    [] as EmotionLog[],
  )
}

export async function saveLog(input: {
  emotionIds: EmotionId[]
  cause: string
  bodyNote: string
  at?: number
}): Promise<number> {
  const at = input.at ?? Date.now()
  return db.emotionLogs.add({
    date: dayKey(new Date(at)),
    at,
    emotionIds: input.emotionIds,
    cause: input.cause,
    bodyNote: input.bodyNote,
  } as EmotionLog)
}

/** Сколько записей в дневнике всего — нужно, чтобы решать, есть ли что терять. */
export function useLogCount(): number {
  return useLiveQuery(() => db.emotionLogs.count(), [], 0)
}

export function useLog(id: number | undefined) {
  return useLiveQuery(
    () => (id === undefined ? undefined : db.emotionLogs.get(id)),
    [id],
  )
}

export async function updateLog(
  id: number,
  patch: { emotionIds: EmotionId[]; cause: string; bodyNote: string; at: number },
) {
  // Дата пересчитывается из времени: поправили час — запись могла уехать на
  // соседний день, и без этого она потерялась бы в выборках по дате.
  await db.emotionLogs.update(id, { ...patch, date: dayKey(new Date(patch.at)) })
}

export async function deleteLog(id: number) {
  await db.transaction('rw', db.emotionLogs, db.iaaaEntries, async () => {
    await db.emotionLogs.delete(id)
    // Разбор ИППП без своей записи остаётся жить, просто теряет ссылку.
    await db.iaaaEntries.where('logId').equals(id).modify({ logId: undefined })
  })
}

/** Какие слова возвращаются чаще всего — ради этого автор и просит вести лист. */
export function useEmotionFrequency(days = 30) {
  const logs = useLogsInRange(days)
  const counts = new Map<EmotionId, number>()
  for (const log of logs) {
    for (const id of log.emotionIds) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count)
}

export interface CategoryStat {
  categoryId: string
  title: string
  valence: Valence
  count: number
  /** Слова, из которых набралась группа, по убыванию. */
  words: { id: EmotionId; word: string; count: number }[]
}

/** Псевдогруппа для слов, которых нет в словаре книги. */
const OWN_WORDS = 'own-words'

/**
 * То же самое, но собранное в группы из книги.
 *
 * По отдельным словам картина не читается: словарь на 797 слов, и за месяц
 * набирается несколько десятков слов по одному разу. Группа «Грусть 14» говорит
 * больше, чем «Печальный 2, Унылый 1, Скорбный 1».
 *
 * Слово может числиться в нескольких группах («Жалкий» сразу в четырёх), поэтому
 * считаем только в первую — иначе сумма раздувается и доли врут.
 */
export function useCategoryStats(days = 30): CategoryStat[] {
  const logs = useLogsInRange(days)

  const byCategory = new Map<string, Map<EmotionId, number>>()

  for (const log of logs) {
    for (const id of log.emotionIds) {
      const emotion = resolveEmotion(id)
      const categoryId = emotion.categoryIds[0] ?? OWN_WORDS
      let words = byCategory.get(categoryId)
      if (!words) {
        words = new Map()
        byCategory.set(categoryId, words)
      }
      words.set(id, (words.get(id) ?? 0) + 1)
    }
  }

  return [...byCategory.entries()]
    .map(([categoryId, words]) => {
      const category = getCategory(categoryId)
      return {
        categoryId,
        title: category?.title ?? 'Свои слова',
        // У своих слов группы нет; относим их к тяжёлым только визуально.
        valence: category?.valence ?? ('heavy' as Valence),
        count: [...words.values()].reduce((sum, n) => sum + n, 0),
        words: [...words.entries()]
          .map(([id, count]) => ({ id, word: resolveEmotion(id).word, count }))
          .sort((a, b) => b.count - a.count),
      }
    })
    .sort((a, b) => b.count - a.count)
}

/* ── ИППП ────────────────────────────────────────────────────────────────── */

export function useOpenApplications() {
  return useLiveQuery(
    () => db.iaaaEntries.where('applicationState').equals(1).reverse().sortBy('at'),
    [],
    [],
  )
}

/* ── Листы изменений ─────────────────────────────────────────────────────── */

export function useTrackerState() {
  return useLiveQuery(() => db.trackerState.toArray(), [], [])
}

export function useActiveTrackers() {
  return useLiveQuery(
    () => db.trackerState.filter((s) => s.active).toArray(),
    [],
    [],
  )
}

export function useTrackerDay(trackerId: string, date: DayKey = dayKey()) {
  return useLiveQuery(
    () => db.trackerDays.get([trackerId, date]),
    [trackerId, date],
  )
}

export function useTrackerHistory(trackerId: string, days = 30) {
  const keys = lastNDays(days)
  return useLiveQuery(
    async () => {
      const rows = await db.trackerDays
        .where('[trackerId+date]')
        .between(
          [trackerId, keys[0]],
          [trackerId, keys[keys.length - 1]],
          true,
          true,
        )
        .toArray()
      const byDate = new Map(rows.map((r) => [r.date, r]))
      return keys.map((date) => ({ date, row: byDate.get(date) }))
    },
    [trackerId, keys[0], keys[keys.length - 1]],
    [] as { date: DayKey; row?: TrackerDay }[],
  )
}

export async function putTrackerDay(
  trackerId: string,
  date: DayKey,
  value: TrackerValue,
  note = '',
) {
  await db.trackerDays.put({
    trackerId,
    date,
    value,
    note,
    updatedAt: Date.now(),
  })
}

/**
 * Возвращает false, если лимит активных навыков уже выбран — интерфейс должен
 * объяснить почему, а не молча проигнорировать нажатие.
 */
export async function setTrackerActive(trackerId: string, active: boolean) {
  return db.transaction('rw', 'trackerState', async () => {
    if (active) {
      const current = await db.trackerState.filter((s) => s.active).count()
      const existing = await db.trackerState.get(trackerId)
      if (!existing?.active && current >= MAX_ACTIVE_TRACKERS) return false
    }
    const existing = await db.trackerState.get(trackerId)
    await db.trackerState.put({
      trackerId,
      active,
      startedAt: existing?.startedAt ?? Date.now(),
      customTitle: existing?.customTitle,
      customIntro: existing?.customIntro,
    })
    return true
  })
}

/* ── Настройки ───────────────────────────────────────────────────────────── */

export function useSetting<T>(key: string, fallback: T): T {
  const row = useLiveQuery(() => db.settings.get(key), [key])
  return (row?.value as T) ?? fallback
}

export async function setSetting(key: string, value: unknown) {
  await db.settings.put({ key, value })
}
