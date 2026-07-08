'use client'

import { useEffect, useState } from 'react'

// "🔔 Notify me when clips are ready" toggle (HANDOFF §22.2 п.9).
// Registers /sw.js, asks notification permission, subscribes via the
// Push API and stores the subscription server-side. On iPhone this
// only works when the app is installed to the Home Screen (iOS
// 16.4+) — when Push is unavailable we show the install hint instead
// of a dead button.

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

type PushState =
  | 'checking'
  | 'unsupported'
  | 'ios-needs-install'
  | 'off'
  | 'denied'
  | 'busy'
  | 'on'

export default function PushToggle({
  clinicId,
  compact = false,
}: {
  clinicId: string
  compact?: boolean
}) {
  const [state, setState] = useState<PushState>('checking')

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

  useEffect(() => {
    if (!vapidKey) return setState('unsupported')
    const supported =
      'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    if (!supported) {
      // iOS Safari exposes Push only inside an installed PWA.
      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as { standalone?: boolean }).standalone === true
      return setState(isIOS && !standalone ? 'ios-needs-install' : 'unsupported')
    }
    if (Notification.permission === 'denied') return setState('denied')

    navigator.serviceWorker
      .getRegistration('/sw.js')
      .then((reg) => reg?.pushManager.getSubscription() ?? null)
      .then((sub) => setState(sub ? 'on' : 'off'))
      .catch(() => setState('off'))
  }, [vapidKey])

  async function enable() {
    if (!vapidKey) return
    setState('busy')
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off')
        return
      }
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
        }))
      const res = await fetch(`/api/push/subscribe?clinicId=${clinicId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      })
      if (!res.ok) throw new Error(`subscribe failed (${res.status})`)
      setState('on')
    } catch (e) {
      console.warn('push subscribe failed:', e)
      setState('off')
    }
  }

  if (state === 'checking' || state === 'unsupported') return null

  if (state === 'ios-needs-install') {
    if (compact) return null
    return (
      <p className="text-xs text-neutral-400">
        🔔 To get &quot;clip ready&quot; notifications on iPhone, add this app
        to your Home Screen first (Share → Add to Home Screen).
      </p>
    )
  }

  if (state === 'denied') {
    if (compact) return null
    return (
      <p className="text-xs text-neutral-400">
        🔕 Notifications are blocked for this site — enable them in browser
        settings to get &quot;clip ready&quot; pings.
      </p>
    )
  }

  if (state === 'on') {
    return (
      <span className={`text-xs font-medium text-emerald-600 ${compact ? '' : 'py-1'}`}>
        🔔 Clip notifications on
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={enable}
      disabled={state === 'busy'}
      className={
        compact
          ? 'text-xs font-medium text-violet-600 hover:text-violet-700 disabled:opacity-60'
          : 'w-full rounded-2xl border border-violet-200 bg-violet-50 py-3 text-sm font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-60'
      }
    >
      {state === 'busy' ? 'Enabling…' : '🔔 Notify me when clips are ready'}
    </button>
  )
}
