'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

// "From the floor" — the photos and clips the medical assistants
// upload through the clinic's Google Form (the MA handout: 2-3 a day,
// no captions, no editing). The form writes into a Drive folder; this
// panel is the app's mirror of it, so the team sees the media in
// Content Machine and not only in Drive.
//
// Deliberately separate from the doctor's own takes: different
// shooters, different purpose (b-roll), different review. The
// teleprompter tab stays exactly what it was.

export interface FloorItem {
  id: string
  kind: 'photo' | 'video'
  fileName: string
  driveUrl: string
  thumbnailUrl: string | null
  fileId: string
  uploader: string | null
  folderName: string | null
  durationSec: number | null
  sizeBytes: number | null
  uploadedAt: string
}

const GLASS = {
  background: 'rgba(255,255,255,0.7)',
  border: '1px solid rgba(255,255,255,0.85)',
  boxShadow: '0 2px 16px rgba(0,0,0,0.05)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
} as const

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function fmtDuration(sec: number | null): string | null {
  if (sec == null) return null
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`
}

// Same stable preview URLs the recordings gallery uses — they work for
// any viewer once the file is link-viewable (the sync sets that).
function thumbUrl(fileId: string, size = 800): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`
}

type Filter = 'all' | 'video' | 'photo'

// Drive generates a video's poster frame asynchronously — a file
// uploaded minutes ago answers /thumbnail with 404 for a while (bigger
// file, longer wait), then starts serving it. So a failed thumbnail is
// retried a few times instead of leaving a grey tile until the next
// page load, and the tile says what it is waiting for.
const THUMB_RETRIES = 4
const THUMB_RETRY_MS = 45_000

function Tile({
  item,
  onOpen,
}: {
  item: FloorItem
  onOpen: () => void
}) {
  const [attempt, setAttempt] = useState(0)
  const [broken, setBroken] = useState(false)
  const duration = fmtDuration(item.durationSec)

  useEffect(() => {
    if (!broken || attempt >= THUMB_RETRIES) return
    const t = setTimeout(() => {
      setBroken(false)
      setAttempt((a) => a + 1)
    }, THUMB_RETRY_MS)
    return () => clearTimeout(t)
  }, [broken, attempt])
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex min-w-0 flex-col gap-2 text-left"
    >
      <div
        className="relative aspect-square w-full overflow-hidden rounded-xl"
        style={{ background: 'linear-gradient(135deg,#0f766e 0%,#14b8a6 60%,#5eead4 100%)' }}
      >
        {!broken && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            // The cache-buster is what makes the retry a real request —
            // the browser has the 404 cached under the plain URL.
            key={attempt}
            src={attempt === 0 ? thumbUrl(item.fileId) : `${thumbUrl(item.fileId)}&r=${attempt}`}
            alt=""
            loading="lazy"
            onError={() => setBroken(true)}
            className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        {item.kind === 'video' && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition group-hover:bg-black/65">
              <svg className="ml-0.5 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </span>
        )}
        {duration && (
          <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">
            {duration}
          </span>
        )}
        {broken && attempt >= THUMB_RETRIES && (
          <span className="absolute bottom-2 left-2 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-medium text-white/90">
            preview processing
          </span>
        )}
      </div>
      <span className="block min-w-0 px-0.5">
        <span className="block truncate text-[12px] font-medium text-neutral-800" title={item.fileName}>
          {item.uploader ?? item.fileName}
        </span>
        <span className="block text-[11px] text-neutral-400">{fmtTime(item.uploadedAt)}</span>
      </span>
    </button>
  )
}

function Lightbox({ item, onClose }: { item: FloorItem; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-neutral-950"
        onClick={(e) => e.stopPropagation()}
      >
        {item.kind === 'video' ? (
          <div className="aspect-video w-full bg-black">
            <iframe
              src={`https://drive.google.com/file/d/${item.fileId}/preview`}
              className="h-full w-full"
              allow="autoplay; fullscreen"
              allowFullScreen
              title={item.fileName}
            />
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl(item.fileId, 1600)}
            alt={item.fileName}
            className="max-h-[75vh] w-full bg-black object-contain"
          />
        )}
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white" title={item.fileName}>
              {item.fileName}
            </p>
            <p className="mt-0.5 text-xs text-neutral-400">
              {item.uploader ? `${item.uploader} · ` : ''}
              {fmtDay(item.uploadedAt)}, {fmtTime(item.uploadedAt)}
              {item.folderName ? ` · ${item.folderName}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={item.driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20"
            >
              Open in Drive
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function FloorPanel({
  clinicId,
  isAdmin,
  initialItems,
  folderConnected,
}: {
  clinicId: string
  isAdmin: boolean
  initialItems: FloorItem[]
  folderConnected: boolean
}) {
  const [items, setItems] = useState<FloorItem[]>(initialItems)
  const [connected, setConnected] = useState(folderConnected)
  const [filter, setFilter] = useState<Filter>('all')
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [folderInput, setFolderInput] = useState('')

  // Opening the tab clears the dashboard badge for this device — same
  // per-browser localStorage stamp the clips badge uses.
  useEffect(() => {
    try {
      localStorage.setItem(`cm_floor_seen_${clinicId}`, new Date().toISOString())
    } catch {
      // private mode — the badge just stays, harmless
    }
  }, [clinicId, items.length])

  const sync = useCallback(
    async (silent: boolean) => {
      setSyncing(true)
      if (!silent) setError(null)
      try {
        const res = await fetch(`/api/floor/sync?clinicId=${clinicId}`, { method: 'POST' })
        const data = (await res.json().catch(() => ({}))) as {
          items?: FloorItem[]
          added?: number
          error?: string
        }
        if (!res.ok) throw new Error(data.error || `Sync failed (${res.status})`)
        if (data.items) setItems(normalize(data.items))
        setNote(
          data.added ? `${data.added} new ${data.added === 1 ? 'file' : 'files'} pulled in` : null
        )
      } catch (e) {
        // A silent background refresh must not shout at the doctor —
        // the stored gallery is still on screen and still correct.
        if (!silent) setError(e instanceof Error ? e.message : 'Sync failed')
      } finally {
        setSyncing(false)
      }
    },
    [clinicId]
  )

  // Freshness on open: whatever the MAs uploaded since the last cron
  // shows up without anyone pressing a button.
  useEffect(() => {
    if (connected) void sync(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected])

  async function connectFolder() {
    setSyncing(true)
    setError(null)
    try {
      const res = await fetch(`/api/floor/folder?clinicId=${clinicId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: folderInput }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        items?: FloorItem[]
        folder?: { name: string }
        error?: string
      }
      if (!res.ok) throw new Error(data.error || `Could not connect (${res.status})`)
      if (data.items) setItems(normalize(data.items))
      setConnected(true)
      setFolderInput('')
      setNote(`Connected to “${data.folder?.name ?? 'Drive folder'}”`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect')
    } finally {
      setSyncing(false)
    }
  }

  const shown = useMemo(
    () => (filter === 'all' ? items : items.filter((i) => i.kind === filter)),
    [items, filter]
  )

  const groups = useMemo(() => {
    const map = new Map<string, FloorItem[]>()
    for (const it of shown) {
      const key = fmtDay(it.uploadedAt)
      const arr = map.get(key)
      if (arr) arr.push(it)
      else map.set(key, [it])
    }
    return Array.from(map.entries())
  }, [shown])

  const counts = useMemo(
    () => ({
      video: items.filter((i) => i.kind === 'video').length,
      photo: items.filter((i) => i.kind === 'photo').length,
    }),
    [items]
  )

  const open = items.find((i) => i.id === openId) ?? null

  if (!connected) {
    return (
      <div className="rounded-2xl p-8 text-center" style={GLASS}>
        <h2 className="text-lg font-semibold text-neutral-900">
          No upload folder connected yet
        </h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-neutral-500">
          The medical assistants upload their photos and clips through the clinic&apos;s
          Google Form. Connect the Drive folder that form writes into and everything they
          submit shows up here.
        </p>
        {isAdmin ? (
          <div className="mx-auto mt-6 flex max-w-lg flex-col gap-2">
            <input
              value={folderInput}
              onChange={(e) => setFolderInput(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/…"
              className="h-11 rounded-xl border border-neutral-200 bg-white/80 px-3 text-sm outline-none focus:border-teal-400"
            />
            <button
              type="button"
              onClick={connectFolder}
              disabled={syncing || folderInput.trim().length === 0}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-teal-600 px-6 text-sm font-semibold text-white transition hover:bg-teal-500 disabled:opacity-60"
            >
              {syncing ? 'Connecting…' : 'Connect folder'}
            </button>
            <p className="text-left text-xs text-neutral-400">
              In Drive it is the folder named “&lt;Form title&gt; (File responses)”. Share it
              with the Google account Content Machine uses, then paste the link.
            </p>
          </div>
        ) : (
          <p className="mt-4 text-xs text-neutral-400">
            Ask the content team to connect it.
          </p>
        )}
        {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-xl p-1" style={GLASS}>
          {(
            [
              ['all', `All ${items.length}`],
              ['video', `Clips ${counts.video}`],
              ['photo', `Photos ${counts.photo}`],
            ] as Array<[Filter, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                filter === key
                  ? 'bg-teal-600 text-white'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {note && <span className="text-xs text-teal-700">{note}</span>}
          <button
            type="button"
            onClick={() => void sync(false)}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white/70 px-3 py-2 text-xs font-medium text-neutral-600 transition hover:bg-white hover:text-neutral-900 disabled:opacity-60"
          >
            {syncing && (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
            )}
            {syncing ? 'Checking Drive…' : 'Sync now'}
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
      )}

      {shown.length === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={GLASS}>
          <h2 className="text-base font-semibold text-neutral-900">Nothing here yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">
            When the MA team submits the form, their photos and clips land here within the
            day — or press Sync now to pull them immediately.
          </p>
        </div>
      ) : (
        groups.map(([day, list]) => (
          <section key={day}>
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
              {day}
            </p>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {list.map((it) => (
                <Tile key={it.id} item={it} onOpen={() => setOpenId(it.id)} />
              ))}
            </div>
          </section>
        ))
      )}

      {open && <Lightbox item={open} onClose={() => setOpenId(null)} />}
    </div>
  )
}

// The API returns rows in DB shape; the panel works in camelCase.
export function normalize(rows: FloorItem[]): FloorItem[] {
  return rows.map((r) => {
    const row = r as unknown as Record<string, unknown>
    return {
      id: String(row.id),
      kind: (row.kind as 'photo' | 'video') ?? 'photo',
      fileName: String(row.file_name ?? row.fileName ?? 'Untitled'),
      driveUrl: String(row.drive_url ?? row.driveUrl ?? ''),
      thumbnailUrl: (row.thumbnail_url ?? row.thumbnailUrl ?? null) as string | null,
      fileId: String(row.drive_file_id ?? row.fileId ?? ''),
      uploader: (row.uploader ?? null) as string | null,
      folderName: (row.drive_folder_name ?? row.folderName ?? null) as string | null,
      durationSec: (row.duration_sec ?? row.durationSec ?? null) as number | null,
      sizeBytes: (row.size_bytes ?? row.sizeBytes ?? null) as number | null,
      uploadedAt: String(row.uploaded_at ?? row.uploadedAt ?? new Date().toISOString()),
    }
  })
}
