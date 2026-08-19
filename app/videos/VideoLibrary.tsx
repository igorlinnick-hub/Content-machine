'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

// Doctor's video library — a gallery of takes with one in-app player.
// Desktop: player pinned on the right, list scrolls on the left.
// Phone: player on top, list below. Selecting a card swaps the embed.
// Read-only by design (see app/videos/page.tsx).

export interface LibraryItem {
  id: string
  kind: 'recording' | 'edited'
  title: string
  fileId: string
  driveUrl: string
  durationSec: number | null
  sizeBytes: number | null
  createdAt: string
}

type Tab = 'recording' | 'edited'

function fmtDuration(sec: number | null): string {
  if (sec == null) return '—'
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function fmtBytes(b: number | null): string {
  if (!b) return ''
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function fmtTimeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

// Drive renders a frame thumbnail for link-viewable videos. When it doesn't
// (fresh upload, still processing) the <img> errors and we fall back to the
// gradient tile — never a broken-image icon.
function thumbUrl(fileId: string): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w640`
}

const GLASS = {
  background: 'rgba(255,255,255,0.7)',
  border: '1px solid rgba(255,255,255,0.85)',
  boxShadow: '0 2px 16px rgba(0,0,0,0.05)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
} as const

function Thumb({ item, active }: { item: LibraryItem; active: boolean }) {
  const [broken, setBroken] = useState(false)
  return (
    <div
      className={`relative aspect-video w-full shrink-0 overflow-hidden rounded-xl ${
        active ? 'ring-2 ring-violet-500 ring-offset-2 ring-offset-white/60' : ''
      }`}
      style={{ background: 'linear-gradient(135deg,#312e81 0%,#6d28d9 60%,#a855f7 100%)' }}
    >
      {!broken && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbUrl(item.fileId)}
          alt=""
          loading="lazy"
          onError={() => setBroken(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-full text-white backdrop-blur-sm transition ${
            active ? 'bg-violet-600' : 'bg-black/40 group-hover:bg-black/60'
          }`}
        >
          {active ? (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg className="ml-0.5 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </span>
      </div>
      <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">
        {fmtDuration(item.durationSec)}
      </span>
      {item.kind === 'edited' && (
        <span className="absolute left-2 top-2 rounded-md bg-emerald-500/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          Edited
        </span>
      )}
    </div>
  )
}

export default function VideoLibrary({
  recordings,
  edited,
  teleprompterHref,
}: {
  recordings: LibraryItem[]
  edited: LibraryItem[]
  teleprompterHref: string
}) {
  const hasEdited = edited.length > 0
  // Land on the edited tab when the team has already delivered something —
  // that's the version the doctor actually wants to see first.
  const [tab, setTab] = useState<Tab>(hasEdited ? 'edited' : 'recording')
  const items = tab === 'edited' ? edited : recordings
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null)

  // Switching tabs re-points the player at the first item of the new list.
  useEffect(() => {
    setSelectedId(items[0]?.id ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const selected = useMemo(
    () => items.find((i) => i.id === selectedId) ?? null,
    [items, selectedId]
  )

  // Group by day so a doctor with many takes can scan by session.
  const groups = useMemo(() => {
    const map = new Map<string, LibraryItem[]>()
    for (const it of items) {
      const key = fmtDate(it.createdAt)
      const arr = map.get(key)
      if (arr) arr.push(it)
      else map.set(key, [it])
    }
    return Array.from(map.entries())
  }, [items])

  if (recordings.length === 0 && edited.length === 0) {
    return (
      <div className="rounded-2xl p-10 text-center" style={GLASS}>
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-violet-500"
          style={{ background: 'linear-gradient(145deg,#f7f8fd 0%,#e3e7f3 100%)' }}
        >
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9A2.25 2.25 0 0013.5 5.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25Z" />
          </svg>
        </div>
        <h2 className="mt-4 text-lg font-semibold text-neutral-900">No videos yet</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">
          Record your first take in the teleprompter — it lands here the moment the
          upload finishes.
        </p>
        <Link
          href={teleprompterHref}
          className="cm-btn cm-btn-primary mt-6 inline-flex h-11 items-center rounded-xl px-6 text-sm font-semibold"
        >
          Open teleprompter
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Tabs */}
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex rounded-xl p-1" style={GLASS}>
          {(['edited', 'recording'] as Tab[])
            .filter((t) => t === 'recording' || hasEdited)
            .map((t) => {
              const count = t === 'edited' ? edited.length : recordings.length
              const active = tab === t
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    active ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-600 hover:bg-white/70'
                  }`}
                >
                  {t === 'edited' ? 'Edited' : 'Recordings'}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${
                      active ? 'bg-white/20 text-white' : 'bg-neutral-900/5 text-neutral-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
        </div>
        <Link
          href={teleprompterHref}
          className="hidden items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-500 sm:inline-flex"
        >
          <span className="h-2 w-2 rounded-full bg-white" />
          Record new
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        {/* Player — first on phone (order), pinned on desktop */}
        <div className="order-1 lg:order-2">
          <div className="lg:sticky lg:top-6">
            <div className="overflow-hidden rounded-2xl" style={GLASS}>
              {selected ? (
                <>
                  <div className="aspect-video w-full bg-black">
                    <iframe
                      key={selected.fileId}
                      src={`https://drive.google.com/file/d/${selected.fileId}/preview`}
                      className="h-full w-full"
                      allow="autoplay; fullscreen"
                      allowFullScreen
                      title={selected.title}
                    />
                  </div>
                  <div className="flex items-start justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold text-neutral-900">
                        {selected.title}
                      </h2>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {selected.kind === 'edited' ? 'Edited video' : 'Raw recording'}
                        {' · '}
                        {fmtDate(selected.createdAt)}, {fmtTimeOfDay(selected.createdAt)}
                        {' · '}
                        {fmtDuration(selected.durationSec)}
                        {selected.sizeBytes ? ` · ${fmtBytes(selected.sizeBytes)}` : ''}
                      </p>
                    </div>
                    <a
                      href={selected.driveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white/70 px-3 py-1.5 text-xs font-medium text-neutral-600 transition hover:bg-white hover:text-neutral-900"
                      title="Open in Google Drive (download / share)"
                    >
                      Open in Drive
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                    </a>
                  </div>
                </>
              ) : (
                <div className="flex aspect-video items-center justify-center text-sm text-neutral-400">
                  Select a video to play it here
                </div>
              )}
            </div>
            {tab === 'recording' && hasEdited && (
              <p className="mt-2 px-1 text-xs text-neutral-400">
                Edited versions of your takes live under the{' '}
                <button onClick={() => setTab('edited')} className="font-medium text-violet-600 hover:underline">
                  Edited
                </button>{' '}
                tab.
              </p>
            )}
          </div>
        </div>

        {/* List */}
        <div className="order-2 flex flex-col gap-5 lg:order-1">
          {items.length === 0 ? (
            <div className="rounded-2xl p-6 text-sm text-neutral-500" style={GLASS}>
              {tab === 'edited'
                ? 'No edited videos yet — the team is on it.'
                : 'No recordings yet.'}
            </div>
          ) : (
            groups.map(([day, list]) => (
              <section key={day}>
                <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
                  {day}
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                  {list.map((it) => {
                    const active = it.id === selectedId
                    return (
                      <button
                        key={it.id}
                        onClick={() => {
                          setSelectedId(it.id)
                          // On phone the player sits above the list — bring it back into view.
                          if (window.innerWidth < 1024) window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                        className="group flex flex-col gap-2 rounded-2xl p-2 text-left transition hover:bg-white/60"
                        style={active ? GLASS : undefined}
                      >
                        <Thumb item={it} active={active} />
                        <span className="min-w-0 px-1 pb-1">
                          <span
                            className={`block truncate text-[13px] font-medium ${
                              active ? 'text-violet-700' : 'text-neutral-800'
                            }`}
                          >
                            {it.title}
                          </span>
                          <span className="block text-[11px] text-neutral-400">
                            {fmtTimeOfDay(it.createdAt)}
                            {it.sizeBytes ? ` · ${fmtBytes(it.sizeBytes)}` : ''}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      </div>

      {/* Phone: record button at the bottom, in thumb reach */}
      <Link
        href={teleprompterHref}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-violet-600 text-sm font-semibold text-white shadow-sm sm:hidden"
      >
        <span className="h-2 w-2 rounded-full bg-white" />
        Record new
      </Link>
    </div>
  )
}
