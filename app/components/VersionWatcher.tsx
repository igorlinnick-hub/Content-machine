'use client'

import { useEffect, useRef, useState } from 'react'

// Keeps an installed PWA on the current build without the doctor doing
// anything. An iOS home-screen app can stay "open" for weeks — iOS just
// resumes the old JS bundle — so a fix we ship never reaches the phone until
// someone thinks to pull-to-refresh. This asks /api/version whenever the app
// comes back to the foreground (plus a slow background poll) and reloads once
// the served build changes.
//
// Guards, in order of how much damage they prevent:
//  1. Never reload while the user is typing — losing a half-written script is
//     worse than running yesterday's build for another minute.
//  2. Confirm the change with a second request before acting, so a mid-rollout
//     mix of old/new instances can't bounce the app in a loop.
//  3. At most one reload per REFRESH_COOLDOWN_MS, tracked in sessionStorage.
//
// When a guard blocks the reload the page is left on a build the server no
// longer serves, and the failure mode is SILENT: buttons stop doing anything
// and nothing on screen says why (Igor hit this twice on 2026-08-19 — Generate
// and Compose both looked dead). So a blocked reload now raises a visible
// banner instead of nothing.

const POLL_MS = 15 * 60 * 1000
const CONFIRM_DELAY_MS = 4000
const REFRESH_COOLDOWN_MS = 60 * 1000
const COOLDOWN_KEY = 'cm_version_reloaded_at'

async function fetchVersion(): Promise<string | null> {
  try {
    const res = await fetch('/api/version', { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as { v?: string }
    return typeof data.v === 'string' ? data.v : null
  } catch {
    return null // offline — try again on the next foreground
  }
}

/** True while the user is mid-input; reloading now would throw work away. */
function isBusy(): boolean {
  const el = document.activeElement as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    el.isContentEditable
  )
}

function recentlyReloaded(): boolean {
  try {
    const at = Number(sessionStorage.getItem(COOLDOWN_KEY) || 0)
    return at > 0 && Date.now() - at < REFRESH_COOLDOWN_MS
  } catch {
    return false
  }
}

export function VersionWatcher() {
  const booted = useRef<string | null>(null)
  const checking = useRef(false)
  const [stale, setStale] = useState(false)

  useEffect(() => {
    let alive = true

    async function check() {
      if (!alive || checking.current) return
      checking.current = true
      try {
        const v = await fetchVersion()
        if (!alive || !v || v === 'dev') return

        // First answer of the session — that's the build we're running.
        if (booted.current === null) {
          booted.current = v
          return
        }
        if (v === booted.current) return
        // A newer build is live. If we cannot reload right now, say so —
        // never leave the user clicking a dead page.
        if (isBusy() || recentlyReloaded()) {
          setStale(true)
          return
        }

        // Confirm before acting (guard 2).
        await new Promise((r) => setTimeout(r, CONFIRM_DELAY_MS))
        if (!alive) return
        const again = await fetchVersion()
        if (!alive || again !== v) return
        if (isBusy() || recentlyReloaded()) {
          setStale(true)
          return
        }

        try { sessionStorage.setItem(COOLDOWN_KEY, String(Date.now())) } catch { /* private mode */ }
        window.location.reload()
      } finally {
        checking.current = false
      }
    }

    void check()

    const onVisible = () => { if (document.visibilityState === 'visible') void check() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    const t = setInterval(() => { if (document.visibilityState === 'visible') void check() }, POLL_MS)

    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      clearInterval(t)
    }
  }, [])

  if (!stale) return null

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-[100] flex items-center justify-center gap-3 border-t border-amber-200 bg-amber-50/95 px-4 py-2.5 text-[13px] text-amber-900 backdrop-blur"
    >
      <span>
        A newer version is live — this page is out of date and its buttons may
        not work.
      </span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-lg bg-amber-900 px-3 py-1 text-[12px] font-semibold text-amber-50 transition hover:opacity-85"
      >
        Refresh
      </button>
    </div>
  )
}
