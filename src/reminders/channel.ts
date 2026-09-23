/**
 * Канал напоминаний.
 *
 * Приложение не знает, как именно до него достучались: сегодня это Web Push
 * через Cloudflare Worker, завтра может быть телеграм-бот или что-то ещё.
 * Менять придётся только реализацию — всё остальное работает через этот тип.
 */
export * from '../../shared/schedule'
import type { ReminderSchedule, ReminderTime } from '../../shared/schedule'

export type ReminderStatus =
  /** Браузер не умеет push. */
  | 'unsupported'
  /** Браузер умеет, но не задан VAPID-ключ — приложение развёрнуто не до конца. */
  | 'unconfigured'
  | 'denied'
  | 'off'
  | 'on'
  | 'error'

export interface ReminderChannel {
  /** Поддерживается ли канал в этом браузере вообще. */
  isSupported(): boolean
  status(): Promise<ReminderStatus>
  /** Запрашивает разрешение и подписывается. */
  enable(schedule: ReminderSchedule): Promise<ReminderStatus>
  /** Меняет расписание уже существующей подписки. */
  updateSchedule(schedule: ReminderSchedule): Promise<void>
  /** Времена, выбранные на сегодня, чтобы человек не гадал. */
  todayPlan(): Promise<ReminderTime[]>
  disable(): Promise<void>
  /** Отправить тестовое уведомление прямо сейчас. */
  test(): Promise<void>
}
