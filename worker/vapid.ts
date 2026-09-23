/**
 * Подпись VAPID и отправка push-сообщений без содержимого.
 *
 * Пуш намеренно пустой: сервер не знает, что происходит в дневнике, и не может
 * ничего о нём рассказать. Поэтому здесь нет шифрования тела (aes128gcm) —
 * только подпись JWT алгоритмом ES256 средствами WebCrypto.
 */

function b64urlToBytes(s: string): Uint8Array {
  const padded = (s + '='.repeat((4 - (s.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const raw = atob(padded)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function bytesToB64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function jsonToB64url(value: unknown): string {
  return bytesToB64url(new TextEncoder().encode(JSON.stringify(value)))
}

/**
 * Ключи от `npx web-push generate-vapid-keys`: публичный — несжатая точка
 * P-256 (65 байт, начинается с 0x04), приватный — 32-байтовый скаляр.
 * WebCrypto принимает их только в виде JWK, поэтому собираем его вручную.
 */
export async function importVapidKey(
  publicKey: string,
  privateKey: string,
): Promise<CryptoKey> {
  const pub = b64urlToBytes(publicKey)
  if (pub.length !== 65 || pub[0] !== 0x04) {
    throw new Error('VAPID_PUBLIC_KEY: ожидается несжатая точка P-256 (65 байт)')
  }

  return crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      x: bytesToB64url(pub.slice(1, 33)),
      y: bytesToB64url(pub.slice(33, 65)),
      d: privateKey.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
      ext: true,
      key_ops: ['sign'],
    } as JsonWebKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
}

export async function createVapidJwt(
  audience: string,
  subject: string,
  key: CryptoKey,
): Promise<string> {
  const header = jsonToB64url({ typ: 'JWT', alg: 'ES256' })
  const payload = jsonToB64url({
    aud: audience,
    // Спецификация требует не больше 24 часов; берём 12 с запасом.
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: subject,
  })

  const data = new TextEncoder().encode(`${header}.${payload}`)
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    data,
  )

  return `${header}.${payload}.${bytesToB64url(new Uint8Array(signature))}`
}

export interface PushResult {
  ok: boolean
  status: number
  /** Подписка мертва — её нужно удалить из хранилища. */
  gone: boolean
}

export async function sendEmptyPush(
  endpoint: string,
  vapidPublicKey: string,
  key: CryptoKey,
  subject: string,
): Promise<PushResult> {
  const audience = new URL(endpoint).origin
  const jwt = await createVapidJwt(audience, subject, key)

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
      TTL: '3600',
      'Content-Length': '0',
      Urgency: 'normal',
    },
  })

  return {
    ok: res.ok,
    status: res.status,
    gone: res.status === 404 || res.status === 410,
  }
}
