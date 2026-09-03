'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import FloorPanel, { type FloorItem } from './FloorPanel'

// Doctor's video library — a gallery of takes with one in-app player.
// Desktop: player pinned on the right, list scrolls on the left.
// Phone: player on top, list below. Selecting a card swaps the embed.
// Read-only by design (see app/videos/page.tsx).
//
// Two tabs, deliberately separate feeds: "My videos" is what the
// doctor recorded in the teleprompter (plus the edited versions), and
// "From the floor" is what the medical assistants upload through the
// Google Form. Same screen, no extra dashboard card — but never mixed
// into one gallery: different shooters, different purpose.
//
// The floor tab is ADMIN ONLY (asked for 2026-08-31): the MA feed is
// raw, unreviewed b-roll for the content team. A doctor opening this
// page sees exactly what they saw before — their own takes, no tabs.

export type Tab = 'mine' | 'floor'

// A direct link to one of the clinic's own Drive folders (recordings,
// finished edits, raw uploads, photos). Built server-side in page.tsx.
export interface FolderLink {
  key: string
  label: string
  url: string
}

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
    </div>
  )
}

export default function VideoLibrary({
  recordings,
  edited,
  folders,
  teleprompterHref,
  clinicId,
  isAdmin,
  floorItems,
  floorConnected,
  initialTab = 'mine',
}: {
  recordings: LibraryItem[]
  edited: LibraryItem[]
  folders: FolderLink[]
  teleprompterHref: string
  clinicId: string
  isAdmin: boolean
  floorItems: FloorItem[]
  floorConnected: boolean
  initialTab?: Tab
}) {
  // A push about an MA upload deep-links straight to its tab (?tab=floor).
  const [tab, setTab] = useState<Tab>(initialTab)
  // Recordings are owned locally so a delete updates the gallery without a
  // round-trip re-render; edited clips are read-only on this screen.
  const [recs, setRecs] = useState<LibraryItem[]>(recordings)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  // One flat gallery — edited versions and raw takes together, newest first.
  const items = useMemo(
    () =>
      [...edited, ...recs].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [edited, recs]
  )
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null)

  async function deleteRecording(item: LibraryItem) {
    if (deleting || item.kind !== 'recording') return
    const ok = window.confirm(
      `Delete "${item.title}"?\n\nThis removes the video from the app and from the clinic's Drive folder. It cannot be undone.`
    )
    if (!ok) return
    setDeleting(item.id)
    setDeleteError(null)
    try {
      const res = await fetch('/api/studio/recordings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordingId: item.id }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error || `Delete failed (${res.status})`)
      }
      setRecs((prev) => {
        const next = prev.filter((r) => r.id !== item.id)
        if (selectedId === item.id) {
          // Keep the player on the neighbour so the screen doesn't go blank.
          const idx = prev.findIndex((r) => r.id === item.id)
          setSelectedId(next[Math.min(idx, next.length - 1)]?.id ?? null)
        }
        return next
      })
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeleting(null)
    }
  }

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

  // "Your files live in your Drive" made tangible: one chip per folder.
  // Shown above the gallery for doctors and admins alike — the folders are
  // the clinic's own materials, promised exportable at any time.
  const folderRow =
    folders.length > 0 ? (
      <div className="flex flex-wrap items-center gap-2 px-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
          Your folders in Drive
        </span>
        {folders.map((f) => (
          <a
            key={f.key}
            href={f.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-neutral-600 transition hover:text-neutral-900"
            style={GLASS}
            title={`Open the ${f.label} folder in Google Drive (view / download / share)`}
          >
            <svg className="h-3.5 w-3.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
            {f.label}
            <svg className="h-3 w-3 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </a>
        ))}
      </div>
    ) : null

  const emptyMine = (
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

  const mine = (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <p className="px-1 text-sm text-neutral-500">
          {items.length} {items.length === 1 ? 'video' : 'videos'}
        </p>
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
                        {fmtDate(selected.createdAt)}, {fmtTimeOfDay(selected.createdAt)}
                        {' · '}
                        {fmtDuration(selected.durationSec)}
                        {selected.sizeBytes ? ` · ${fmtBytes(selected.sizeBytes)}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <a
                        href={selected.driveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-white/70 px-3 py-1.5 text-xs font-medium text-neutral-600 transition hover:bg-white hover:text-neutral-900"
                        title="Open in Google Drive (download / share)"
                      >
                        Open in Drive
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                      </a>
                      {selected.kind === 'recording' && (
                        <button
                          onClick={() => deleteRecording(selected)}
                          disabled={deleting === selected.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-white/70 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                          title="Delete this recording from the app and Drive"
                        >
                          {deleting === selected.id ? (
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-rose-200 border-t-rose-600" />
                          ) : (
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          )}
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                  {deleteError && (
                    <p className="border-t border-rose-100 bg-rose-50/70 px-4 py-2 text-xs text-rose-700">
                      {deleteError}
                    </p>
                  )}
                </>
              ) : (
                <div className="flex aspect-video items-center justify-center text-sm text-neutral-400">
                  Select a video to play it here
                </div>
              )}
            </div>
          </div>
        </div>

        {/* List */}
        <div className="order-2 flex flex-col gap-5 lg:order-1">
          {items.length === 0 ? (
            <div className="rounded-2xl p-6 text-sm text-neutral-500" style={GLASS}>
              No videos yet.
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
                    const busy = deleting === it.id
                    return (
                      // min-w-0 on the grid cell is what lets `truncate` work —
                      // without it long titles spill across the neighbour card.
                      <div
                        key={it.id}
                        className={`group relative flex min-w-0 flex-col gap-2 rounded-2xl p-2 transition hover:bg-white/60 ${
                          busy ? 'opacity-50' : ''
                        }`}
                        style={active ? GLASS : undefined}
                      >
                        <button
                          onClick={() => {
                            setSelectedId(it.id)
                            // On phone the player sits above the list — bring it back into view.
                            if (window.innerWidth < 1024) window.scrollTo({ top: 0, behavior: 'smooth' })
                          }}
                          className="flex w-full min-w-0 flex-col gap-2 text-left"
                          disabled={busy}
                        >
                          <Thumb item={it} active={active} />
                          <span className="block w-full min-w-0 px-1 pb-1">
                            <span
                              className={`block truncate text-[13px] font-medium ${
                                active ? 'text-violet-700' : 'text-neutral-800'
                              }`}
                              title={it.title}
                            >
                              {it.title}
                            </span>
                            <span className="block text-[11px] text-neutral-400">
                              {fmtTimeOfDay(it.createdAt)}
                              {it.sizeBytes ? ` · ${fmtBytes(it.sizeBytes)}` : ''}
                            </span>
                          </span>
                        </button>
                        {it.kind === 'recording' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteRecording(it)
                            }}
                            disabled={busy}
                            aria-label="Delete recording"
                            title="Delete recording"
                            // Hover-reveal on pointer devices; always visible on touch
                            // (no hover there), sized for a thumb.
                            className="absolute right-3.5 top-3.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white opacity-100 backdrop-blur-sm transition hover:bg-rose-600 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </button>
                        )}
                      </div>
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

  // Doctors get the plain gallery, no tab strip at all. The folder row still
  // renders on an empty library — the photo folders exist before take one.
  if (!isAdmin)
    return (
      <div className="flex flex-col gap-5">
        {folderRow}
        {recs.length === 0 && edited.length === 0 ? emptyMine : mine}
      </div>
    )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-1 self-start rounded-xl p-1" style={GLASS}>
        {(
          [
            ['mine', `My videos${items.length ? ` ${items.length}` : ''}`, 'bg-violet-600'],
            ['floor', `From the floor${floorItems.length ? ` ${floorItems.length}` : ''}`, 'bg-teal-600'],
          ] as Array<[Tab, string, string]>
        ).map(([key, label, active]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
              tab === key ? `${active} text-white` : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'mine' ? (
        <>
          {folderRow}
          {recs.length === 0 && edited.length === 0 ? emptyMine : mine}
        </>
      ) : (
        <FloorPanel
          clinicId={clinicId}
          isAdmin={isAdmin}
          initialItems={floorItems}
          folderConnected={floorConnected}
        />
      )}
    </div>
  )
}
