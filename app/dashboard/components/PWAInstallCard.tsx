'use client'

import { useEffect, useState } from 'react'

type Platform = 'ios' | 'android' | 'desktop' | 'unknown'

function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'unknown'
  const ua = window.navigator.userAgent
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'desktop'
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  // iOS Safari sets navigator.standalone when launched from home screen.
  const iosStandalone =
    'standalone' in window.navigator &&
    Boolean(
      (window.navigator as Navigator & { standalone?: boolean }).standalone
    )
  // Other PWAs (Android Chrome, desktop) report via display-mode media query.
  const mqStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches
  return iosStandalone || mqStandalone
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Shown to anyone (admin or doctor) who is browsing in a regular tab
// on iPhone / Android / desktop. Hides itself when the app is already
// installed (running in standalone mode). On Android we hook into
// `beforeinstallprompt` for one-tap install. On iOS Safari there is
// no programmatic install — we render the manual Share → Add to Home
// Screen steps. On desktop we render a QR code so the user can scan
// it on their phone.
export function PWAInstallCard() {
  const [platform, setPlatform] = useState<Platform>('unknown')
  const [installed, setInstalled] = useState(true) // assume installed until checked
  const [androidPrompt, setAndroidPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    setPlatform(detectPlatform())
    setInstalled(isStandalone())

    const handler = (e: Event) => {
      e.preventDefault()
      setAndroidPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (installed) return null

  async function triggerAndroidInstall() {
    if (!androidPrompt) return
    await androidPrompt.prompt()
    const { outcome } = await androidPrompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setAndroidPrompt(null)
  }

  return (
    <section className="rounded-xl border border-sky-200 bg-sky-50 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">
            Install on your phone
          </p>
          <h3 className="mt-1 text-lg font-semibold text-neutral-900">
            Open this app from the home screen
          </h3>
          <p className="mt-1 text-sm text-neutral-600">
            Same login, no browser bars, opens in one tap.
          </p>
        </div>
      </div>

      {platform === 'ios' && (
        <ol className="mt-4 flex flex-col gap-2 text-sm text-neutral-700">
          <li>
            <span className="font-semibold text-neutral-900">1.</span> You must
            be in <em>Safari</em> (not Chrome — it can&apos;t install web apps
            on iOS).
          </li>
          <li>
            <span className="font-semibold text-neutral-900">2.</span> Tap the{' '}
            <strong>Share</strong> icon (square with ↑) at the bottom.
          </li>
          <li>
            <span className="font-semibold text-neutral-900">3.</span> Scroll
            down → tap <strong>Add to Home Screen</strong> → Add.
          </li>
          <li>
            <span className="font-semibold text-neutral-900">4.</span> Open the
            new icon. Login is preserved — no need to scan the link again.
          </li>
        </ol>
      )}

      {platform === 'android' && androidPrompt && (
        <button
          type="button"
          onClick={triggerAndroidInstall}
          className="cm-btn cm-btn-primary mt-4 text-sm"
        >
          Install now
        </button>
      )}

      {platform === 'android' && !androidPrompt && (
        <ol className="mt-4 flex flex-col gap-2 text-sm text-neutral-700">
          <li>
            <span className="font-semibold text-neutral-900">1.</span> Open the
            menu (⋮) at the top right of Chrome.
          </li>
          <li>
            <span className="font-semibold text-neutral-900">2.</span> Tap{' '}
            <strong>Install app</strong> (or <strong>Add to Home screen</strong>).
          </li>
        </ol>
      )}

      {platform === 'desktop' && (
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-sm text-neutral-700">
            You&apos;re on a computer. To put this on a phone you need a{' '}
            <strong>doctor install link</strong> — that link carries the
            login, so the phone opens straight into the dashboard with no
            password.
          </p>
          <a
            href="/clinics"
            className="cm-btn cm-btn-primary self-start text-xs"
          >
            Open Clinics → grab install QR →
          </a>
          <p className="text-[11px] text-neutral-500">
            Plain URL QR (without a token) lands on the login screen — the
            phone has no way to log in, that&apos;s why nothing happens.
          </p>
        </div>
      )}

      {platform === 'unknown' && (
        <p className="mt-3 text-sm text-neutral-600">
          On iPhone: Safari → Share → Add to Home Screen. On Android: Chrome
          menu → Install app.
        </p>
      )}
    </section>
  )
}
