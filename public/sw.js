// Service worker for web-push notifications (HANDOFF §22.2 п.9).
// Registered by app/components/PushToggle.tsx. Push payload is JSON:
// { title, body, url } — sent by lib/push/send.ts.

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'Content Machine'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icon',
      badge: '/icon',
      data: { url: data.url || '/clips' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/clips'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const win of wins) {
        if (win.url.includes('/clips') && 'focus' in win) return win.focus()
      }
      return clients.openWindow(url)
    })
  )
})
