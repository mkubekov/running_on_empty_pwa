/**
 * Вход по паролю.
 *
 * Гейт стоит в воркере, а не в приложении: посторонний не получает ни страницы,
 * ни бандла, ни словаря — только форму входа. Пароль хранится в секретах
 * воркера, поэтому из JS его вычитать нельзя, в отличие от «секрета в сборке».
 *
 * Сессия — подписанная кука. Ничего не храним в KV: бесплатный тариф даёт
 * тысячу записей в сутки, и тратить их на вход глупо.
 */

const COOKIE = 'pnn_session'
/** Год: это личное приложение на своём телефоне, а не банк. */
const SESSION_TTL_SECONDS = 365 * 24 * 60 * 60

function toBase64Url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): Uint8Array {
  const padded = (s + '='.repeat((4 - (s.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const raw = atob(padded)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

async function sign(payload: string, secret: string): Promise<string> {
  const mac = await crypto.subtle.sign(
    'HMAC',
    await hmacKey(secret),
    new TextEncoder().encode(payload),
  )
  return toBase64Url(new Uint8Array(mac))
}

/** Сравнение за постоянное время: подпись не подобрать по задержке ответа. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function createSession(secret: string): Promise<string> {
  const payload = toBase64Url(
    new TextEncoder().encode(
      JSON.stringify({ exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS }),
    ),
  )
  return `${payload}.${await sign(payload, secret)}`
}

export async function hasValidSession(
  request: Request,
  secret: string,
): Promise<boolean> {
  const cookies = request.headers.get('Cookie') ?? ''
  const match = cookies.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`))
  if (!match) return false

  const [payload, signature] = match[1].split('.')
  if (!payload || !signature) return false
  if (!constantTimeEqual(signature, await sign(payload, secret))) return false

  try {
    const { exp } = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)))
    return typeof exp === 'number' && exp > Math.floor(Date.now() / 1000)
  } catch {
    return false
  }
}

export function sessionCookie(token: string): string {
  return [
    `${COOKIE}=${token}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ].join('; ')
}

/**
 * Форма входа. Обычный POST без JavaScript — так вход работает раньше, чем
 * загрузится приложение, и не зависит от service worker.
 */
/**
 * Путь из запроса попадает в HTML, поэтому экранируем всё, а не только
 * кавычки: полагаться на то, что URL сам всё закодирует, не стоит.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function loginPage(next: string, failed: boolean): Response {
  // Только внутренние пути: «//зло.рф» браузер считает внешним адресом,
  // и открытый редирект после входа нам не нужен.
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/'
  const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>Почти на нуле</title>
<style>
  :root { color-scheme: dark }
  body {
    margin: 0; min-height: 100dvh; display: grid; place-items: center;
    background: #12141c; color: #e9e6dd; padding: 1.5rem;
    font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  form { width: 100%; max-width: 20rem }
  h1 { font-size: 1.5rem; font-weight: 600; margin: 0 0 .5rem }
  p { margin: 0 0 1.5rem; font-size: .875rem; color: #9aa0b6 }
  label { display: block; font-size: .75rem; color: #7d8398; margin-bottom: .5rem }
  input {
    width: 100%; box-sizing: border-box; min-height: 2.75rem;
    background: transparent; color: #e9e6dd; font-size: 1rem;
    border: 0; border-bottom: 1px solid #3a4260; padding: 0 0 .25rem;
  }
  input:focus { outline: none; border-bottom-color: #a89cf2 }
  button {
    width: 100%; min-height: 2.75rem; margin-top: 1.5rem; font-size: 1rem;
    background: transparent; color: #a89cf2; border: 1px solid #a89cf2;
    cursor: pointer;
  }
  button:hover { background: #1e1f33 }
  .error { color: #d8a56d; font-size: .8125rem; margin-top: 1rem }
</style>
</head>
<body>
  <form method="POST" action="/api/login">
    <h1>Почти на нуле</h1>
    <p>Личный дневник. Нужен пароль.</p>
    <input type="hidden" name="next" value="${escapeHtml(safeNext)}">
    <label for="p">Пароль</label>
    <input id="p" name="password" type="password" autocomplete="current-password"
           autofocus required>
    <button type="submit">Войти</button>
    ${failed ? '<p class="error">Пароль не подошёл.</p>' : ''}
  </form>
</body>
</html>`

  return new Response(html, {
    status: failed ? 401 : 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}
