'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import QRCode from 'qrcode'

// ── Platform detection ────────────────────────────────────────────────────────

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

// ── Steps data ────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 'scan',   label: 'Scan the QR code',        detail: 'Use your iPhone camera — no app needed' },
  { id: 'safari', label: 'Open in Safari',           detail: 'Tap the link that appears on screen' },
  { id: 'share',  label: 'Tap the Share button',     detail: 'The ⬆ icon at the bottom of Safari' },
  { id: 'add',    label: 'Add to Home Screen',       detail: 'Find it in the list below Share' },
  { id: 'done',   label: 'Tap Add',                  detail: 'The app icon appears on your home screen' },
]
const STEP_MS = 2600

// ── Phone mockup screens ──────────────────────────────────────────────────────

function ScreenScan() {
  return (
    <div className="flex h-full items-center justify-center bg-black" style={{ animation: 'pwa-screen-fade 0.3s ease both' }}>
      {/* Viewfinder */}
      <div className="relative h-32 w-32">
        <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />
        {/* Scan line */}
        <div
          className="absolute left-2 right-2 h-[2px] rounded bg-[#34C759] shadow-[0_0_8px_3px_rgba(52,199,89,0.6)]"
          style={{ animation: 'pwa-scan-line 1.8s ease-in-out infinite' }}
        />
        {/* QR hint dots */}
        <div className="absolute inset-4 grid grid-cols-5 gap-1 opacity-40">
          {[1,0,1,1,0,0,1,0,1,1,1,1,0,0,1,0,1,1,0,1,1,0,0,1,0].map((v, i) => (
            <div key={i} className={`rounded-[1px] ${v ? 'bg-white' : ''}`} />
          ))}
        </div>
      </div>
      <p className="absolute bottom-8 left-0 right-0 text-center text-[9px] text-white/60">
        Point camera at QR code
      </p>
    </div>
  )
}

function ScreenSafari({ url }: { url: string }) {
  const short = url.replace(/^https?:\/\//, '').split('?')[0]
  return (
    <div className="flex h-full flex-col bg-[#F2F2F7]" style={{ animation: 'pwa-screen-fade 0.3s ease both' }}>
      {/* Status bar */}
      <div className="flex items-center justify-between px-3 pt-1 text-[7px] font-semibold text-black">
        <span>9:41</span>
        <div className="flex items-center gap-1 text-[6px]">
          <span>●●●</span><span>WiFi</span><span>100%</span>
        </div>
      </div>
      {/* Address bar */}
      <div className="mx-3 mt-1 flex items-center rounded-lg bg-white px-3 py-1.5 shadow-sm">
        <div className="mr-1 h-2 w-2 rounded-full bg-[#34C759]" />
        <span className="truncate text-[8px] font-medium text-black">{short}</span>
      </div>
      {/* Page skeleton */}
      <div className="mx-3 mt-2 flex flex-1 flex-col gap-1.5 overflow-hidden rounded-xl bg-white p-2 shadow-sm">
        <div className="h-2 w-2/3 rounded bg-neutral-200" />
        <div className="h-1.5 w-full rounded bg-neutral-100" />
        <div className="h-1.5 w-4/5 rounded bg-neutral-100" />
        <div className="mt-1 h-8 w-full rounded-lg bg-sky-100" />
        <div className="h-1.5 w-3/4 rounded bg-neutral-100" />
        <div className="h-1.5 w-full rounded bg-neutral-100" />
      </div>
      {/* Safari toolbar */}
      <div className="flex items-center justify-around border-t border-neutral-300 bg-[#F2F2F7] px-4 py-2">
        <ToolbarIcon path="M15 19l-7-7 7-7" />
        <ToolbarIcon path="M9 19l7-7-7-7" />
        <ToolbarIcon path="M8 10h8M12 6v8" box="0 0 24 24" />
        <ToolbarIcon path="M4 19V5h16v14" />
        <ToolbarIcon path="M4 6h16M4 12h16M4 18h16" />
      </div>
    </div>
  )
}

function ScreenShare() {
  return (
    <div className="flex h-full flex-col bg-[#F2F2F7]" style={{ animation: 'pwa-screen-fade 0.3s ease both' }}>
      {/* Page */}
      <div className="mx-3 mt-7 flex flex-col gap-1.5 rounded-xl bg-white p-2 shadow-sm">
        <div className="h-2 w-2/3 rounded bg-neutral-200" />
        <div className="h-1.5 w-full rounded bg-neutral-100" />
        <div className="mt-1 h-8 w-full rounded-lg bg-sky-100" />
      </div>
      {/* Safari toolbar */}
      <div className="flex items-center justify-around border-t border-neutral-300 bg-[#F2F2F7] px-4 py-2 mt-auto">
        <ToolbarIcon path="M15 19l-7-7 7-7" />
        <ToolbarIcon path="M9 19l7-7-7-7" />
        {/* Share button — animated + tap indicator */}
        <div className="relative" style={{ animation: 'pwa-share-pulse 1.4s ease-in-out infinite' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round">
            <path d="M8 10h8M12 6v8" /><path d="M12 14v6M5 20h14" />
            <path d="M12 6l-3 3M12 6l3 3" />
          </svg>
          <TapMark />
        </div>
        <ToolbarIcon path="M4 19V5h16v14" />
        <ToolbarIcon path="M4 6h16M4 12h16M4 18h16" />
      </div>
    </div>
  )
}

function ScreenAdd() {
  return (
    <div className="relative flex h-full flex-col bg-[#F2F2F7]" style={{ animation: 'pwa-screen-fade 0.3s ease both' }}>
      {/* Page behind */}
      <div className="mx-3 mt-7 flex flex-col gap-1.5 rounded-xl bg-white p-2 shadow-sm opacity-40">
        <div className="h-2 w-2/3 rounded bg-neutral-200" />
        <div className="mt-1 h-8 w-full rounded-lg bg-sky-100" />
      </div>
      {/* Share sheet */}
      <div
        className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white shadow-2xl"
        style={{ animation: 'pwa-sheet-up 0.4s cubic-bezier(0.16,1,0.3,1) both' }}
      >
        {/* Handle */}
        <div className="mx-auto mt-2 h-1 w-8 rounded-full bg-neutral-300" />
        {/* Share icons row */}
        <div className="flex justify-around px-2 py-2">
          {['Msg','Mail','Notes','More'].map((l) => (
            <div key={l} className="flex flex-col items-center gap-0.5">
              <div className="h-8 w-8 rounded-xl bg-neutral-100" />
              <span className="text-[6px] text-neutral-500">{l}</span>
            </div>
          ))}
        </div>
        {/* Action rows */}
        <div className="mx-2 mb-2 overflow-hidden rounded-xl">
          <SheetRow label="Add to Home Screen" icon="＋" highlight tap />
          <div className="h-px bg-neutral-100 ml-8" />
          <SheetRow label="Add Bookmark" icon="🔖" />
          <div className="h-px bg-neutral-100 ml-8" />
          <SheetRow label="Find on Page" icon="🔍" />
        </div>
      </div>
    </div>
  )
}

function ScreenDone() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-gradient-to-b from-sky-400 to-blue-600" style={{ animation: 'pwa-screen-fade 0.3s ease both' }}>
      {/* Home screen grid bg */}
      <div className="grid grid-cols-4 gap-2 px-4 opacity-30">
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} className="h-8 w-8 rounded-xl bg-white/40" />
        ))}
      </div>
      {/* Our app icon */}
      <div
        className="absolute flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-sky-700 shadow-xl"
        style={{ animation: 'pwa-icon-pop 0.6s cubic-bezier(0.16,1,0.3,1) 0.2s both' }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" fill="white" opacity="0.9"/>
          <path d="M9 22V12h6v10" stroke="white" strokeWidth="1.5"/>
        </svg>
      </div>
      <p className="absolute bottom-10 text-center text-[9px] font-semibold text-white">
        Content Machine
      </p>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const cls = {
    tl: 'top-0 left-0 border-t-2 border-l-2',
    tr: 'top-0 right-0 border-t-2 border-r-2',
    bl: 'bottom-0 left-0 border-b-2 border-l-2',
    br: 'bottom-0 right-0 border-b-2 border-r-2',
  }[pos]
  return <div className={`absolute h-6 w-6 rounded-sm border-white ${cls}`} />
}

function ToolbarIcon({ path, box = '0 0 24 24' }: { path: string; box?: string }) {
  return (
    <svg width="16" height="16" viewBox={box} fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round">
      <path d={path} />
    </svg>
  )
}

/** Ripple ring + fingertip — shows where the tap lands. */
function TapMark({ left = '50%' }: { left?: string }) {
  return (
    <span className="pointer-events-none absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2" style={{ left }}>
      <span
        className="absolute left-1/2 top-1/2 block h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#007AFF]"
        style={{ animation: 'pwa-tap-ring 1.4s ease-out infinite' }}
      />
      <span
        className="absolute left-1/2 top-1/2 block h-5 w-5 rounded-full bg-[#007AFF]"
        style={{ animation: 'pwa-tap-dot 1.4s ease-in-out infinite' }}
      />
    </span>
  )
}

function SheetRow({ label, icon, highlight, tap }: { label: string; icon: string; highlight?: boolean; tap?: boolean }) {
  return (
    <div className={`relative flex items-center gap-3 px-3 py-2.5 ${highlight ? 'bg-sky-50' : 'bg-white'}`}>
      {tap && <TapMark left="18%" />}
      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${highlight ? 'bg-[#007AFF] text-white' : 'bg-neutral-100 text-neutral-600'}`}>
        {icon}
      </span>
      <span className={`text-[10px] font-medium ${highlight ? 'text-[#007AFF]' : 'text-neutral-800'}`}>
        {label}
      </span>
    </div>
  )
}

// ── Phone mockup wrapper ──────────────────────────────────────────────────────

function PhoneMockup({ step, installUrl }: { step: number; installUrl: string }) {
  return (
    <div className="relative shrink-0" style={{ width: 160, height: 300 }}>
      {/* Shell */}
      <div className="absolute inset-0 rounded-[2.8rem] bg-[#1c1c1e] shadow-[0_24px_64px_rgba(0,0,0,0.45),inset_0_0_0_1px_rgba(255,255,255,0.08)]" />
      {/* Side buttons */}
      <div className="absolute -left-1 top-20 h-8 w-1 rounded-l bg-[#2c2c2e]" />
      <div className="absolute -left-1 top-32 h-12 w-1 rounded-l bg-[#2c2c2e]" />
      <div className="absolute -right-1 top-24 h-14 w-1 rounded-r bg-[#2c2c2e]" />
      {/* Screen area */}
      <div className="absolute inset-[6px] overflow-hidden rounded-[2.2rem] bg-black">
        {/* Dynamic island */}
        <div className="absolute left-1/2 top-2.5 z-10 h-[11px] w-10 -translate-x-1/2 rounded-full bg-black" />
        {/* Screen content — key forces remount animation */}
        <div key={step} className="absolute inset-0 pt-7">
          {step === 0 && <ScreenScan />}
          {step === 1 && <ScreenSafari url={installUrl} />}
          {step === 2 && <ScreenShare />}
          {step === 3 && <ScreenAdd />}
          {step === 4 && <ScreenDone />}
        </div>
      </div>
      {/* Home indicator */}
      <div className="absolute bottom-[10px] left-1/2 h-[3px] w-[44px] -translate-x-1/2 rounded-full bg-white/25" />
    </div>
  )
}

// ── Install modal ─────────────────────────────────────────────────────────────

function InstallModal({
  clinicId,
  isAdmin,
  onClose,
}: {
  clinicId: string
  isAdmin?: boolean
  onClose: () => void
}) {
  const [step, setStep] = useState(0)
  const [paused, setPaused] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [installUrl, setInstallUrl] = useState('')
  const [copied, setCopied] = useState(false)

  // Load install URL + QR.
  //
  // SECURITY: the QR intentionally encodes ONLY the plain
  // /dashboard URL — never an install-link token. Reason: this
  // card renders on the admin's own dashboard while they're
  // logged-in; if we baked in the clinic's first install-link,
  // anyone who scanned the QR would land straight on the doctor
  // dashboard with a valid cm_token cookie for THAT clinic (seen
  // in the wild — the scanner ended up inside the admin's clinic
  // as a "doctor" without ever entering a key). To share access
  // with a real doctor, use the InstallLinkCard on /clinics —
  // that's where explicit, named, revocable tokens live.
  useEffect(() => {
    void clinicId
    void isAdmin
    async function load() {
      const url = window.location.origin + '/dashboard'
      setInstallUrl(url)
      try {
        const dUrl = await QRCode.toDataURL(url, { width: 180, margin: 1, color: { dark: '#111', light: '#fff' } })
        setQrDataUrl(dUrl)
      } catch { /* ignore */ }
    }
    void load()
  }, [clinicId, isAdmin])

  // Auto-advance steps
  useEffect(() => {
    if (paused) return
    const t = setInterval(() => {
      setStep((s) => (s + 1) % STEPS.length)
    }, STEP_MS)
    return () => clearInterval(t)
  }, [paused])

  // Esc to close + lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  async function copyLink() {
    if (!installUrl) return
    try {
      await navigator.clipboard.writeText(installUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* noop */ }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4 cm-backdrop-in"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="cm-sheet-in flex w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl"
        style={{ maxHeight: '92svh' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-neutral-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 pt-4 sm:px-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-sky-500">
              Install on your phone
            </p>
            <h2 className="mt-0.5 text-xl font-semibold text-neutral-900">
              Add to iPhone Home Screen
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-800"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-5 pb-6 sm:flex-row sm:items-start sm:px-6">
          {/* Phone */}
          <div className="flex justify-center sm:justify-start">
            <PhoneMockup step={step} installUrl={installUrl} />
          </div>

          {/* Steps list + QR */}
          <div className="flex flex-1 flex-col gap-4">
            {/* Step progress bar */}
            <div className="h-0.5 w-full overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-sky-400 transition-all duration-300"
                style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
              />
            </div>

            {/* Steps */}
            <ol className="flex flex-col gap-2">
              {STEPS.map((s, i) => {
                const done = i < step
                const active = i === step
                return (
                  <li
                    key={s.id}
                    onClick={() => { setStep(i); setPaused(true) }}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 ${
                      active ? 'bg-sky-50 ring-1 ring-sky-200' : 'hover:bg-neutral-50'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ring-1 transition-all duration-200 ${
                        done
                          ? 'bg-emerald-500 text-white ring-emerald-500'
                          : active
                            ? 'bg-sky-500 text-white ring-sky-500'
                            : 'bg-white text-neutral-400 ring-neutral-300'
                      }`}
                    >
                      {done ? '✓' : i + 1}
                    </span>
                    <div>
                      <p className={`text-sm font-semibold ${active ? 'text-sky-800' : done ? 'text-emerald-700' : 'text-neutral-500'}`}>
                        {s.label}
                      </p>
                      {active && (
                        <p className="mt-0.5 text-xs text-sky-600">{s.detail}</p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>

            {/* QR code */}
            <div className="mt-1 flex flex-col items-center gap-2 rounded-2xl border border-neutral-100 bg-neutral-50 p-4">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="QR code" className="h-[120px] w-[120px] rounded-lg" />
              ) : (
                <div className="h-[120px] w-[120px] animate-pulse rounded-lg bg-neutral-200" />
              )}
              <p className="text-[11px] text-neutral-500">Scan with iPhone camera to open in Safari</p>
              <button
                type="button"
                onClick={copyLink}
                className="text-[11px] font-medium text-sky-600 transition hover:text-sky-800"
              >
                {copied ? '✓ Copied' : 'or copy link'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── iOS install instructions ─────────────────────────────────────────────────
//
// Auto-opens once per device; after "Got it" the dismissal is remembered and
// the only remaining surface is a small pill, so a doctor who tapped too early
// can replay the walkthrough instead of being stuck.

const IOS_DISMISS_KEY = 'cm_pwa_ios_dismissed'
const IOS_STEP_MS = 3400

const IOS_STEPS = [
  { title: 'Tap Share',          detail: 'The ⬆ icon in the Safari bar below',   screen: 2 },
  { title: 'Add to Home Screen', detail: 'Scroll the list that slides up',        screen: 3 },
  { title: 'Tap Add',            detail: 'The icon lands on your home screen',    screen: 4 },
]

/** The desktop mockup, scaled down — same screens, phone-sized. */
function MiniPhone({ screen }: { screen: number }) {
  const scale = 0.66
  return (
    <div className="shrink-0" style={{ width: 160 * scale, height: 300 * scale }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <PhoneMockup step={screen} installUrl="" />
      </div>
    </div>
  )
}

function IOSInstructionSheet({ onClose }: { onClose: () => void }) {
  const [show, setShow] = useState(false)
  const [step, setStep] = useState(0)
  const [paused, setPaused] = useState(false)

  // Slide in on mount
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 40)
    return () => clearTimeout(t)
  }, [])

  // Auto-advance the walkthrough until the user takes over
  useEffect(() => {
    if (paused) return
    const t = setInterval(() => setStep((s) => (s + 1) % IOS_STEPS.length), IOS_STEP_MS)
    return () => clearInterval(t)
  }, [paused])

  // Lock page scroll while the sheet is up
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const close = useCallback(() => {
    setShow(false)
    setTimeout(onClose, 280)
  }, [onClose])

  const pick = (i: number) => { setStep(i); setPaused(true) }

  return createPortal(
    <>
      {/* Dim backdrop */}
      <div
        className="fixed inset-0 z-40 transition-opacity duration-300"
        style={{
          backgroundColor: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(2px)',
          opacity: show ? 1 : 0,
          pointerEvents: show ? 'auto' : 'none',
        }}
        onClick={close}
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-white shadow-2xl"
        style={{
          transform: show ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.42s cubic-bezier(0.16,1,0.3,1)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
          maxHeight: '92svh',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3">
          <div className="h-1 w-10 rounded-full bg-neutral-200" />
        </div>

        <div className="px-5 pb-2 pt-3">
          {/* Header */}
          <div className="mb-4 flex items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-md"
              style={{ background: 'linear-gradient(135deg,#38bdf8,#0369a1)' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" fill="white" opacity="0.9" />
                <path d="M9 22V12h6v10" stroke="white" strokeWidth="1.5" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-500">Install</p>
              <h2 className="text-[17px] font-bold leading-tight text-neutral-900">Add to Home Screen</h2>
              <p className="text-[12px] text-neutral-500">Opens fullscreen, no browser bar</p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="ml-auto shrink-0 rounded-full p-2 text-neutral-400 active:bg-neutral-100"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Walkthrough: live mockup + tappable steps */}
          <div className="flex items-start gap-4">
            <MiniPhone screen={IOS_STEPS[step].screen} />

            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              {IOS_STEPS.map((s, i) => {
                const active = i === step
                const done = i < step
                return (
                  <button
                    key={s.title}
                    type="button"
                    onClick={() => pick(i)}
                    className={`flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-all duration-200 ${
                      active ? 'bg-sky-50 ring-1 ring-sky-200' : 'active:bg-neutral-50'
                    }`}
                  >
                    <span
                      className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ring-1 transition-all duration-200 ${
                        done
                          ? 'bg-emerald-500 text-white ring-emerald-500'
                          : active
                            ? 'bg-sky-500 text-white ring-sky-500'
                            : 'bg-white text-neutral-400 ring-neutral-300'
                      }`}
                    >
                      {done ? '✓' : i + 1}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={`block text-[13px] font-semibold leading-snug ${
                          active ? 'text-sky-800' : done ? 'text-emerald-700' : 'text-neutral-500'
                        }`}
                      >
                        {s.title}
                      </span>
                      {active && (
                        <span className="mt-0.5 block text-[11px] leading-snug text-sky-600">{s.detail}</span>
                      )}
                    </span>
                  </button>
                )
              })}

              {/* Progress segments */}
              <div className="mt-1 flex gap-1 px-2.5">
                {IOS_STEPS.map((s, i) => (
                  <span
                    key={s.title}
                    className={`h-0.5 flex-1 rounded-full transition-colors duration-300 ${
                      i <= step ? 'bg-sky-400' : 'bg-neutral-200'
                    }`}
                  />
                ))}
              </div>
              <p className="px-2.5 text-[10px] text-neutral-400">
                {paused ? 'Tap a step to replay it' : 'Playing — tap a step to hold'}
              </p>
            </div>
          </div>

          {/* CTA */}
          <button
            type="button"
            onClick={close}
            className="mt-4 w-full rounded-2xl bg-[#007AFF] py-3.5 text-base font-semibold text-white transition-opacity active:opacity-80"
          >
            Got it
          </button>
        </div>
      </div>
    </>,
    document.body
  )
}

/** Small always-available entry point — the rescue hatch for an early "Got it". */
export function IOSInstallEntry() {
  const [open, setOpen] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let dismissed = false
    try { dismissed = localStorage.getItem(IOS_DISMISS_KEY) === '1' } catch { /* private mode */ }
    setReady(true)
    if (dismissed) return
    const t = setTimeout(() => setOpen(true), 700)
    return () => clearTimeout(t)
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    try { localStorage.setItem(IOS_DISMISS_KEY, '1') } catch { /* private mode */ }
  }, [])

  if (!ready) return null

  return (
    <>
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white/70 px-3 py-1.5 text-[11px] font-medium text-neutral-500 backdrop-blur transition active:scale-95"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v10M8 11l4 4 4-4" /><path d="M5 19h14" />
          </svg>
          Install instructions
        </button>
      </div>

      {open && <IOSInstructionSheet onClose={close} />}
    </>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

interface Props {
  clinicId: string
  isAdmin?: boolean
}

export function PWAInstallCard({ clinicId, isAdmin }: Props) {
  const [platform, setPlatform] = useState<Platform>('unknown')
  const [installed, setInstalled] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [androidPrompt, setAndroidPrompt] = useState<BeforeInstallPromptEvent | null>(null)

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

  const closeModal = useCallback(() => setModalOpen(false), [])

  if (installed) return null
  if (platform === 'ios') return <IOSInstallEntry />

  if (platform === 'android') {
    return (
      <section className="rounded-xl border border-sky-200 bg-sky-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">Install</p>
        <h3 className="mt-1 text-base font-semibold text-neutral-900">Add to Home Screen</h3>
        {androidPrompt ? (
          <button
            type="button"
            onClick={async () => {
              await androidPrompt.prompt()
              const { outcome } = await androidPrompt.userChoice
              if (outcome === 'accepted') setInstalled(true)
              setAndroidPrompt(null)
            }}
            className="cm-btn cm-btn-primary mt-4 text-sm"
          >
            Install now
          </button>
        ) : (
          <ol className="mt-3 flex flex-col gap-2 text-sm text-neutral-700">
            <li>⋮ Open the Chrome menu (top right)</li>
            <li>➕ Tap <strong>Add to Home screen</strong></li>
          </ol>
        )}
      </section>
    )
  }

  // Desktop
  return (
    <>
      <section className="flex items-center justify-between rounded-xl border border-sky-200 bg-sky-50 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-500">Install</p>
          <h3 className="mt-0.5 text-base font-semibold text-neutral-900">Download for iPhone</h3>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="cm-btn cm-btn-primary text-sm"
        >
          Get link →
        </button>
      </section>

      {modalOpen && (
        <InstallModal clinicId={clinicId} isAdmin={isAdmin} onClose={closeModal} />
      )}
    </>
  )
}
