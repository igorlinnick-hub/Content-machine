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

// Open the screen the notification points at. It used to focus ANY
// open /clips window regardless of the payload — with more than one
// kind of ping (clip ready, new recording, MA uploads → /videos?tab=
// floor) that sent every tap to the wrong page.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/dashboard'
  const target = new URL(url, self.location.origin)
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const win of wins) {
        let winUrl
        try {
          winUrl = new URL(win.url)
        } catch {
          continue
        }
        if (winUrl.pathname !== target.pathname) continue
        // Same page, different query (another clinic, another tab) —
        // re-navigate where the browser allows it, else just focus.
        if (winUrl.search !== target.search && 'navigate' in win) {
          return win.navigate(target.href).then((w) => (w ? w.focus() : null))
        }
        if ('focus' in win) return win.focus()
      }
      return clients.openWindow(target.href)
    })
  )
})
