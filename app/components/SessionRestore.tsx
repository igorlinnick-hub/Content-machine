'use client'

import { useEffect, useState } from 'react'
import { getStoredToken, clearStoredToken } from '@/lib/clinic-storage'

// Mounts on the landing page. If the user previously bootstrapped via /c/[token]
// (so we have a backup token in localStorage) but the cookie was lost — common
// on iOS PWA after "Add to Home Screen" — POST it back to /api/auth/restore
// to recreate the cookie, then reload into the dashboard.
export function SessionRestore() {
  const [restoring, setRestoring] = useState(false)

  useEffect(() => {
    const token = getStoredToken()
    if (!token) return
    setRestoring(true)
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/auth/restore', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        if (cancelled) return
        if (res.ok) {
          window.location.replace('/dashboard')
          return
        }
        if (res.status === 401) {
          // token revoked — clear so we don't loop
          clearStoredToken()
        }
      } catch {
        // network error — let the user see the landing page
      } finally {
        if (!cancelled) setRestoring(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!restoring) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
      <p className="text-sm text-neutral-600">Restoring session…</p>
    </div>
  )
}
