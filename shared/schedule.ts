/**
 * Расписание напоминаний: общий код браузера и воркера.
 *
 * Браузер показывает, во сколько сегодня придут напоминания; воркер по этим
 * же правилам решает, когда слать. Держим в одном файле, чтобы две стороны
 * не разошлись в понимании «случайно, но не чаще чем раз в два часа».
 */

/** «HH:mm» в локальном времени человека. */
export type ReminderTime = string

/**
 * Расписание задаётся диапазоном, а не списком точных времён: ровно в 14:00
 * каждый день — это будильник, на который перестаёшь реагировать. Конкретные
 * моменты выбираются случайно внутри диапазона, заново на каждый день.
 */
export interface ReminderSchedule {
  /** Начало окна, «HH:mm». */
  from: ReminderTime
  /** Конец окна, «HH:mm». */
  to: ReminderTime
  /** Сколько раз за день. */
  count: number
  /** Минимум минут между двумя напоминаниями, чтобы не слиплись. */
  minGapMinutes: number
}

export const DEFAULT_SCHEDULE: ReminderSchedule = {
  from: '09:00',
  to: '22:00',
  count: 3,
  minGapMinutes: 120,
}

/** Больше шести пушей в день — это уже не практика, а раздражитель. */
export const MAX_REMINDERS_PER_DAY = 6

export const GAP_CHOICES = [30, 60, 90, 120, 180] as const

export function minutesOf(time: ReminderTime): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function timeOf(minutes: number): ReminderTime {
  const m = ((minutes % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/**
 * Сколько напоминаний реально помещается в окно с таким промежутком.
 * Окно 09:00–22:00 при промежутке в 3 часа вмещает максимум пять штук,
 * и интерфейс обязан сказать об этом, а не молча слать меньше.
 */
export function maxCountFor(schedule: Omit<ReminderSchedule, 'count'>): number {
  const span = minutesOf(schedule.to) - minutesOf(schedule.from)
  if (span < 0) return 1
  return Math.max(1, Math.floor(span / Math.max(1, schedule.minGapMinutes)) + 1)
}

export function isScheduleValid(schedule: ReminderSchedule): boolean {
  return (
    minutesOf(schedule.to) > minutesOf(schedule.from) &&
    schedule.count >= 1 &&
    schedule.count <= MAX_REMINDERS_PER_DAY &&
    schedule.count <= maxCountFor(schedule)
  )
}

/**
 * Случайные моменты внутри окна с гарантированным промежутком.
 *
 * Резервируем (count-1) * minGap минут под промежутки, остаток раскидываем
 * равномерно, затем раздвигаем. Так распределение остаётся честно случайным,
 * а не «случайным с оговорками»: никакого перебора с отбраковкой.
 */
export function rollTimes(
  schedule: ReminderSchedule,
  random: () => number = Math.random,
): ReminderTime[] {
  const start = minutesOf(schedule.from)
  const span = minutesOf(schedule.to) - start
  const count = Math.max(1, Math.min(schedule.count, maxCountFor(schedule)))
  const gap = schedule.minGapMinutes

  const slack = span - (count - 1) * gap
  if (slack < 0) return [timeOf(start)]

  const offsets = Array.from({ length: count }, () => random() * slack).sort(
    (a, b) => a - b,
  )

  return offsets.map((offset, i) => timeOf(Math.round(start + offset + i * gap)))
}
