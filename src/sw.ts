/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('install', () => {
  void self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

/**
 * Пуш приходит пустым — сервер не знает и не должен знать, что происходит в
 * дневнике. Текст подбираем здесь. Слотов дня в приложении нет, поэтому
 * формулировка зависит только от времени суток и чередуется, чтобы за месяц
 * не превратиться в шум, который глаз перестаёт замечать.
 */
const PROMPTS: string[] = [
  'Что вы чувствуете прямо сейчас?',
  'Полминуты на себя: какое чувство сейчас на фоне?',
  'Закройте глаза и посмотрите внутрь — что там?',
  'Какое слово подошло бы вашему состоянию сейчас?',
  'Что с вами происходит в эту минуту?',
]

function notificationText(now = new Date()): { title: string; body: string } {
  const title = PROMPTS[(now.getDate() * 7 + now.getHours()) % PROMPTS.length]
  const body =
    now.getHours() >= 21
      ? 'Отметьте чувства и загляните в свой лист изменений.'
      : 'Одна запись занимает меньше минуты.'
  return { title, body }
}

self.addEventListener('push', (event) => {
  const { title, body } = notificationText()
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      // Один тег: новое напоминание заменяет старое, а не копится в шторке.
      tag: 'reminder',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      data: { url: '/log' },
    } as NotificationOptions),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? '/'

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      // Если приложение уже открыто — не плодим вкладки, а переводим фокус.
      for (const client of clients) {
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client) await client.navigate(url)
          return
        }
      }
      await self.clients.openWindow(url)
    })(),
  )
})
