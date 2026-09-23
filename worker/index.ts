import { importVapidKey, sendEmptyPush } from './vapid'
import {
  constantTimeEqual,
  createSession,
  hasValidSession,
  loginPage,
  sessionCookie,
} from './auth'
import { isScheduleValid, minutesOf, rollTimes } from '../shared/schedule'
import type { ReminderSchedule, ReminderTime } from '../shared/schedule'

export interface Env {
  SUBS: KVNamespace
  ASSETS: Fetcher
  VAPID_PUBLIC_KEY: string
  VAPID_PRIVATE_KEY: string
  /**
   * Контакт владельца ключа для push-сервиса (требование спецификации VAPID).
   * Уведомления доставляются системным пушем на устройство; почта здесь ни при
   * чём — на этот адрес ничего не отправляется.
   */
  VAPID_SUBJECT: string
  /** Пароль на вход. Лежит в секретах, в сборку не попадает. */
  APP_PASSWORD: string
  /** Ключ подписи сессионной куки. */
  SESSION_SECRET: string
}

/**
 * Всё, что мы храним о человеке: куда доставлять уведомление и в каком окне.
 * Ни одной записи дневника здесь нет и быть не может.
 */
interface Subscription {
  endpoint: string
  /**
   * Выдаётся при подписке и известен только этому устройству. Без него
   * расписание нельзя ни прочитать, ни поменять, ни удалить: иначе любой,
   * кто узнал адрес доставки, отключил бы человеку напоминания.
   */
  token: string
  schedule: ReminderSchedule
  /** Минуты к UTC, например 180 для Москвы. */
  tzOffset: number
  /** Разыгранные на сегодня времена и то, что уже отправлено. */
  plan?: { date: string; times: ReminderTime[]; sent: ReminderTime[] }
}

/**
 * Находит подписку и проверяет, что запрос пришёл от её владельца.
 * Сравнение за постоянное время — токен угадывать по таймингу не дадим.
 */
async function authorize(
  env: Env,
  body: Record<string, unknown>,
): Promise<{ key: string; sub: Subscription } | null> {
  const endpoint = body.endpoint
  const token = body.token
  if (typeof endpoint !== 'string' || typeof token !== 'string') return null

  const key = await keyFor(endpoint)
  const sub = await env.SUBS.get<Subscription>(key, 'json')
  if (!sub?.token || !constantTimeEqual(sub.token, token)) return null

  return { key, sub }
}

/** Ключ KV — хэш endpoint: сам адрес длинный и в ключ не помещается. */
async function keyFor(endpoint: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(endpoint),
  )
  return (
    'sub:' +
    [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
  )
}

function json(body: unknown, status = 200, request?: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...(request ? cors(request) : {}) },
  })
}

function cors(request: Request): HeadersInit {
  const origin = request.headers.get('Origin')
  return origin
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      }
    : {}
}

function parseSchedule(value: unknown): ReminderSchedule | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Record<string, unknown>
  const schedule: ReminderSchedule = {
    from: String(v.from ?? ''),
    to: String(v.to ?? ''),
    count: Number(v.count),
    minGapMinutes: Number(v.minGapMinutes),
  }
  const isTime = (t: string) => /^\d{2}:\d{2}$/.test(t)
  if (!isTime(schedule.from) || !isTime(schedule.to)) return null
  if (!isScheduleValid(schedule)) return null
  return schedule
}

/** Местные «минуты от полуночи» и дата для конкретной подписки. */
function localNow(tzOffset: number, now: Date) {
  const local = new Date(now.getTime() + tzOffset * 60_000)
  return {
    minutes: local.getUTCHours() * 60 + local.getUTCMinutes(),
    date: local.toISOString().slice(0, 10),
  }
}

/** Разыгрывает времена на новый день, если план устарел или его ещё нет. */
function ensurePlan(sub: Subscription, date: string): boolean {
  if (sub.plan?.date === date) return false
  sub.plan = { date, times: rollTimes(sub.schedule), sent: [] }
  return true
}

async function handleApi(request: Request, env: Env): Promise<Response> {
  const route = new URL(request.url).pathname.replace(/^\/api\//, '')

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors(request) })
  }
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null
  if (!body) return json({ error: 'bad json' }, 400, request)

  switch (route) {
    case 'subscribe': {
      const sub = body.subscription as { endpoint?: string } | undefined
      const schedule = parseSchedule(body.schedule)
      if (!sub?.endpoint || !schedule) {
        return json({ error: 'bad payload' }, 400, request)
      }
      // Повторная подписка того же устройства не должна обнулять токен:
      // иначе человек, переоткрыв приложение, терял бы доступ к расписанию.
      const key = await keyFor(sub.endpoint)
      const previous = await env.SUBS.get<Subscription>(key, 'json')

      const record: Subscription = {
        endpoint: sub.endpoint,
        token: previous?.token ?? crypto.randomUUID(),
        schedule,
        tzOffset: typeof body.tzOffset === 'number' ? body.tzOffset : 0,
      }
      ensurePlan(record, localNow(record.tzOffset, new Date()).date)
      await env.SUBS.put(key, JSON.stringify(record))
      return json(
        { ok: true, token: record.token, times: record.plan?.times ?? [] },
        200,
        request,
      )
    }

    case 'schedule': {
      const schedule = parseSchedule(body.schedule)
      if (!schedule) return json({ error: 'bad payload' }, 400, request)

      const auth = await authorize(env, body)
      if (!auth) return json({ error: 'forbidden' }, 403, request)
      const { key, sub: existing } = auth

      existing.schedule = schedule
      if (typeof body.tzOffset === 'number') existing.tzOffset = body.tzOffset
      // Окно изменилось — старый план недействителен. Сбрасываем дату, и
      // ensurePlan разыграет новые времена.
      if (existing.plan) existing.plan.date = ''
      ensurePlan(existing, localNow(existing.tzOffset, new Date()).date)
      await env.SUBS.put(key, JSON.stringify(existing))
      return json({ ok: true, times: existing.plan?.times ?? [] }, 200, request)
    }

    case 'plan': {
      const auth = await authorize(env, body)
      if (!auth) return json({ error: 'forbidden' }, 403, request)
      const { key, sub } = auth

      if (ensurePlan(sub, localNow(sub.tzOffset, new Date()).date)) {
        await env.SUBS.put(key, JSON.stringify(sub))
      }
      return json({ times: sub.plan?.times ?? [], sent: sub.plan?.sent ?? [] }, 200, request)
    }

    case 'unsubscribe': {
      const auth = await authorize(env, body)
      if (!auth) return json({ error: 'forbidden' }, 403, request)
      await env.SUBS.delete(auth.key)
      return json({ ok: true }, 200, request)
    }

    case 'test': {
      // Без проверки это был бы открытый ретранслятор: кто угодно слал бы
      // пуши на любой адрес, подписанные нашим VAPID-ключом.
      const auth = await authorize(env, body)
      if (!auth) return json({ error: 'forbidden' }, 403, request)
      const endpoint = auth.sub.endpoint
      const result = await sendEmptyPush(
        endpoint,
        env.VAPID_PUBLIC_KEY,
        await importVapidKey(env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY),
        env.VAPID_SUBJECT,
      )
      if (result.gone) await env.SUBS.delete(auth.key)
      return json(result, result.ok ? 200 : 502, request)
    }

    default:
      return json({ error: 'not found' }, 404, request)
  }
}

/**
 * Крон ходит раз в 15 минут, поэтому окно отправки шире шага: если воркер или
 * push-сервис моргнули, напоминание всё равно уйдёт. Но не бесконечно —
 * утреннее напоминание, доехавшее вечером, бесполезно и раздражает.
 */
const SEND_WINDOW_MINUTES = 120

export async function runSchedule(env: Env, now = new Date()): Promise<number> {
  const key = await importVapidKey(env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY)
  let sent = 0

  let cursor: string | undefined
  do {
    const page = await env.SUBS.list({ prefix: 'sub:', cursor })
    cursor = page.list_complete ? undefined : page.cursor

    for (const entry of page.keys) {
      const sub = await env.SUBS.get<Subscription>(entry.name, 'json')
      if (!sub) continue

      const { minutes, date } = localNow(sub.tzOffset, now)
      let changed = ensurePlan(sub, date)
      const plan = sub.plan!

      for (const time of plan.times) {
        if (plan.sent.includes(time)) continue
        const elapsed = minutes - minutesOf(time)
        if (elapsed < 0 || elapsed > SEND_WINDOW_MINUTES) continue

        const result = await sendEmptyPush(
          sub.endpoint,
          env.VAPID_PUBLIC_KEY,
          key,
          env.VAPID_SUBJECT,
        )

        if (result.gone) {
          await env.SUBS.delete(entry.name)
          changed = false
          break
        }
        if (result.ok) {
          plan.sent.push(time)
          changed = true
          sent++
        }
      }

      if (changed) await env.SUBS.put(entry.name, JSON.stringify(sub))
    }
  } while (cursor)

  return sent
}

/**
 * Что отдаём без входа. Манифест и иконки нужны браузеру, чтобы предложить
 * установку, и запрашиваются без куки. Ничего, кроме названия и картинки,
 * они не раскрывают.
 */
function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/manifest.webmanifest' ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/icons/')
  )
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
  const form = await request.formData().catch(() => null)
  const password = form?.get('password')
  const next = String(form?.get('next') ?? '/')

  if (
    typeof password !== 'string' ||
    !env.APP_PASSWORD ||
    !constantTimeEqual(password, env.APP_PASSWORD)
  ) {
    return loginPage(next, true)
  }

  return new Response(null, {
    status: 303,
    headers: {
      // «//зло.рф» — внешний адрес для браузера, открытый редирект не нужен.
      Location: next.startsWith('/') && !next.startsWith('//') ? next : '/',
      'Set-Cookie': sessionCookie(await createSession(env.SESSION_SECRET)),
      'cache-control': 'no-store',
    },
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/login' && request.method === 'POST') {
      return handleLogin(request, env)
    }

    // Гейт стоит перед всем: посторонний не получает ни страницы, ни бандла,
    // ни словаря — только форму входа.
    if (!isPublicPath(url.pathname)) {
      if (!(await hasValidSession(request, env.SESSION_SECRET))) {
        if (url.pathname.startsWith('/api/')) {
          return json({ error: 'unauthorized' }, 401, request)
        }
        return loginPage(url.pathname + url.search, false)
      }
    }

    if (url.pathname.startsWith('/api/')) return handleApi(request, env)
    return env.ASSETS.fetch(request)
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runSchedule(env))
  },
}
