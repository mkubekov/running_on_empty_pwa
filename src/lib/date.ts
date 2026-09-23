import { format, parseISO, startOfDay, subDays } from 'date-fns'
import type { DayKey } from '@/db/schema'

/** Локальный календарный день. Намеренно не UTC: дневник живёт по часам человека. */
export function dayKey(d: Date = new Date()): DayKey {
  return format(d, 'yyyy-MM-dd')
}

export function dayKeyToDate(key: DayKey): Date {
  return startOfDay(parseISO(key))
}

export function lastNDays(n: number, from: Date = new Date()): DayKey[] {
  const out: DayKey[] = []
  for (let i = n - 1; i >= 0; i--) out.push(dayKey(subDays(from, i)))
  return out
}

export function timeLabel(at: number): string {
  return format(new Date(at), 'HH:mm')
}

/** «HH:mm» для поля ввода времени. */
export function timeInputValue(d: Date = new Date()): string {
  return format(d, 'HH:mm')
}

/**
 * Собирает отметку времени из даты и введённого «HH:mm».
 * При правке записи день берётся из неё, а не из сегодняшнего.
 */
export function timestampFromTime(time: string, day: Date = new Date()): number {
  const [h, m] = time.split(':').map(Number)
  const d = new Date(day)
  d.setHours(h, m, 0, 0)
  return d.getTime()
}
