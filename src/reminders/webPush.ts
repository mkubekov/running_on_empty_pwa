import { db } from '@/db/schema'
import type {
  ReminderChannel,
  ReminderSchedule,
  ReminderStatus,
  ReminderTime,
} from './channel'

const VAPID_PUBLIC_KEY: string = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ''
const API_BASE: string = import.meta.env.VITE_API_BASE ?? ''

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const raw = atob(padded)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function api<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}/api/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`)
  return (await res.json()) as T
}

async function registration(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.ready
}

async function currentEndpoint(): Promise<string | null> {
  const sub = await (await registration()).pushManager.getSubscription()
  return sub?.endpoint ?? null
}

/** Смещение зоны фиксируем, чтобы крон считал местное время верно. */
function tzOffset(): number {
  return -new Date().getTimezoneOffset()
}

/**
 * Токен подписки: выдаётся сервером один раз и живёт только на этом
 * устройстве. Без него чужой, узнавший адрес доставки, мог бы отключить
 * напоминания или разослать пуши нашим ключом.
 */
const TOKEN_KEY = 'reminderToken'

async function getToken(): Promise<string | null> {
  const row = await db.settings.get(TOKEN_KEY)
  return typeof row?.value === 'string' ? row.value : null
}

async function setToken(token: string) {
  await db.settings.put({ key: TOKEN_KEY, value: token })
}

/** Запрос от имени владельца подписки. Без токена сервер ответит 403. */
async function authed<T>(path: string, extra: Record<string, unknown> = {}) {
  const endpoint = await currentEndpoint()
  const token = await getToken()
  if (!endpoint || !token) throw new Error('Подписка не оформлена')
  return api<T>(path, { endpoint, token, ...extra })
}

/**
 * Web Push. На сервер уходит только адрес доставки и окно напоминаний —
 * ни одной записи дневника. Сами уведомления приходят вообще без содержимого:
 * текст подбирает service worker уже на устройстве.
 */
export const webPushChannel: ReminderChannel = {
  isSupported() {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    )
  },

  async status(): Promise<ReminderStatus> {
    if (!this.isSupported()) return 'unsupported'
    if (VAPID_PUBLIC_KEY === '') return 'unconfigured'
    if (Notification.permission === 'denied') return 'denied'
    try {
      return (await currentEndpoint()) ? 'on' : 'off'
    } catch {
      return 'error'
    }
  },

  async enable(schedule: ReminderSchedule): Promise<ReminderStatus> {
    if (!this.isSupported()) return 'unsupported'
    if (VAPID_PUBLIC_KEY === '') return 'unconfigured'

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return permission === 'denied' ? 'denied' : 'off'
    }

    const reg = await registration()
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      }))

    const result = await api<{ token?: string }>('subscribe', {
      subscription: sub.toJSON(),
      schedule,
      tzOffset: tzOffset(),
    })
    if (result.token) await setToken(result.token)

    return 'on'
  },

  async updateSchedule(schedule: ReminderSchedule) {
    if (!(await currentEndpoint())) return
    await authed('schedule', { schedule, tzOffset: tzOffset() })
  },

  async todayPlan(): Promise<ReminderTime[]> {
    if (!(await currentEndpoint()) || !(await getToken())) return []
    const result = await authed<{ times?: ReminderTime[] }>('plan')
    return result.times ?? []
  },

  async disable() {
    const reg = await registration()
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return
    // Сервер может и не знать про подписку — отписываемся локально в любом случае.
    await authed('unsubscribe').catch(() => undefined)
    await db.settings.delete(TOKEN_KEY)
    await sub.unsubscribe()
  },

  async test() {
    await authed('test')
  },
}
