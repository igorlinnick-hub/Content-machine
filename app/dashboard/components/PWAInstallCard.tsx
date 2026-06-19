'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

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
  const iosStandalone =
    'standalone' in window.navigator &&
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  const mqStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches
  return iosStandalone || mqStandalone
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface Props {
  clinicId: string
  isAdmin?: boolean
}

const IOS_STEPS = [
  { icon: '🧭', text: 'Open in Safari (not Chrome)' },
  { icon: '⬆️', text: 'Tap the Share button at the bottom' },
  { icon: '➕', text: 'Tap "Add to Home Screen"' },
  { icon: '✅', text: 'Tap "Add" — done' },
]

function AnimatedSteps() {
  const [visible, setVisible] = useState(0)

  useEffect(() => {
    if (visible >= IOS_STEPS.length) return
    const t = setTimeout(() => setVisible((n) => n + 1), 380)
    return () => clearTimeout(t)
  }, [visible])

  return (
    <ol className="mt-3 flex flex-col gap-2">
      {IOS_STEPS.map((step, i) => (
        <li
          key={i}
          className={`flex items-center gap-3 transition-all duration-300 ${
            i < visible ? 'translate-x-0 opacity-100' : 'translate-x-2 opacity-0'
          }`}
        >
          <span className="text-lg leading-none">{step.icon}</span>
          <span className="text-sm text-neutral-700">{step.text}</span>
        </li>
      ))}
    </ol>
  )
}

export function PWAInstallCard({ clinicId, isAdmin }: Props) {
  const [platform, setPlatform] = useState<Platform>('unknown')
  const [installed, setInstalled] = useState(true)
  const [androidPrompt, setAndroidPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showSteps, setShowSteps] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [installUrl, setInstallUrl] = useState<string | null>(null)
  const [loadingQr, setLoadingQr] = useState(false)

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

  async function loadQr() {
    setLoadingQr(true)
    try {
      // Try to get a tokenized install link (admin only)
      let url = window.location.origin + '/dashboard'
      if (isAdmin) {
        const res = await fetch(
          `/api/admin/install-link?clinicId=${encodeURIComponent(clinicId)}`
        )
        if (res.ok) {
          const data = await res.json()
          const first = (data.links ?? [])[0] as { url?: string } | undefined
          if (first?.url) url = first.url
        }
      }
      setInstallUrl(url)
      const dataUrl = await QRCode.toDataURL(url, { width: 200, margin: 1 })
      setQrDataUrl(dataUrl)
    } catch {
      // ignore — show URL fallback
    } finally {
      setLoadingQr(false)
      setShowSteps(true)
    }
  }

  // ── iOS: already on the phone — just show steps ──────────────────────────
  if (platform === 'ios') {
    return (
      <section className="rounded-xl border border-sky-200 bg-sky-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">
          Install on your phone
        </p>
        <h3 className="mt-1 text-base font-semibold text-neutral-900">
          Add to Home Screen
        </h3>
        <AnimatedSteps />
      </section>
    )
  }

  // ── Android ──────────────────────────────────────────────────────────────
  if (platform === 'android') {
    return (
      <section className="rounded-xl border border-sky-200 bg-sky-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">
          Install on your phone
        </p>
        <h3 className="mt-1 text-base font-semibold text-neutral-900">
          Add to Home Screen
        </h3>
        {androidPrompt ? (
          <button
            type="button"
            onClick={triggerAndroidInstall}
            className="cm-btn cm-btn-primary mt-4 text-sm"
          >
            Install now
          </button>
        ) : (
          <ol className="mt-3 flex flex-col gap-2">
            <li className="flex items-center gap-3 text-sm text-neutral-700">
              <span className="text-lg">⋮</span> Open the Chrome menu (top right)
            </li>
            <li className="flex items-center gap-3 text-sm text-neutral-700">
              <span className="text-lg">➕</span> Tap <strong>Add to Home screen</strong>
            </li>
          </ol>
        )}
      </section>
    )
  }

  // ── Desktop: generate QR → scan on iPhone ───────────────────────────────
  return (
    <section className="rounded-xl border border-sky-200 bg-sky-50 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">
        Install on your phone
      </p>
      <h3 className="mt-1 text-base font-semibold text-neutral-900">
        Download for iPhone
      </h3>

      {!showSteps ? (
        <button
          type="button"
          onClick={loadQr}
          disabled={loadingQr}
          className="cm-btn cm-btn-primary mt-4 text-sm"
        >
          {loadingQr ? 'Getting link…' : 'Get iPhone link →'}
        </button>
      ) : (
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
          {/* QR code */}
          <div className="flex flex-col items-center gap-2">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt="Scan to install"
                className="h-[140px] w-[140px] rounded-lg border border-neutral-200 bg-white p-1"
              />
            ) : (
              <div className="flex h-[140px] w-[140px] items-center justify-center rounded-lg border border-neutral-200 bg-white text-xs text-neutral-400">
                QR unavailable
              </div>
            )}
            <p className="text-[11px] text-neutral-500">Scan with iPhone camera</p>
            {installUrl && (
              <a
                href={installUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-sky-600 underline"
              >
                or copy link
              </a>
            )}
          </div>

          {/* Steps */}
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Then on Safari:
            </p>
            <AnimatedSteps />
          </div>
        </div>
      )}
    </section>
  )
}
