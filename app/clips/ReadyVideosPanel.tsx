'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ClipRow } from '@/lib/clips/store'

// Ready videos (HANDOFF §22.2): every processed clip, watchable
// right in the app — scroll the list on the left, play the selected
// final on the right (Drive embed). Processing/failed rows show
// their status in the same list so the editor sees the whole queue
// in one place.

function fmtDuration(sec: number | null): string {
  if (sec == null) return '—'
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

const STATUS_STYLES: Record<ClipRow['status'], string> = {
  cleaned: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  processing: 'bg-sky-50 text-sky-700 border-sky-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  failed: 'bg-rose-50 text-rose-700 border-rose-200',
}

function driveFileUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`
}

function folderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`
}

export default function ReadyVideosPanel({ clips }: { clips: ClipRow[] }) {
  const router = useRouter()
  const firstReady = clips.find((c) => c.status === 'cleaned' && c.cleaned_file_id)
  const [selectedId, setSelectedId] = useState<string | null>(firstReady?.id ?? null)
  const [removing, setRemoving] = useState<string | null>(null)
  const selected = clips.find((c) => c.id === selectedId) ?? null

  async function removeClipRow(clip: ClipRow) {
    if (removing) return
    if (!window.confirm('Remove this entry from the list?')) return
    setRemoving(clip.id)
    try {
      const res = await fetch(`/api/clips/${clip.id}`, { method: 'DELETE' })
      if (res.ok) router.refresh()
    } finally {
      setRemoving(null)
    }
  }

  if (clips.length === 0) {
    return (
      <section>
        <h2 className="text-sm font-semibold text-neutral-900">Ready videos</h2>
        <p className="mt-2 text-sm text-neutral-500">
          No processed clips yet. Run Auto-edit on a recording above — the
          finished video appears here.
        </p>
      </section>
    )
  }

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-neutral-900">
          Ready videos{' '}
          <span className="font-normal text-neutral-400">({clips.length})</span>
        </h2>
        <p className="text-xs text-neutral-400">
          Finals also live in the clinic&apos;s Drive folder
        </p>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(260px,340px)_1fr]">
        {/* Scrollable clip list */}
        <div className="max-h-[420px] overflow-y-auto rounded-2xl border border-neutral-200 bg-white">
          {clips.map((clip) => {
            const active = selected?.id === clip.id
            const playable = clip.status === 'cleaned' && clip.cleaned_file_id
            return (
              <div
                key={clip.id}
                className={`border-b border-neutral-100 px-3 py-2.5 last:border-0 ${
                  playable ? 'cursor-pointer' : 'opacity-80'
                } ${active ? 'bg-violet-50' : playable ? 'hover:bg-neutral-50' : ''}`}
                onClick={() => playable && setSelectedId(clip.id)}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-800"
                    title={clip.drive_inbox_file_name}
                  >
                    {clip.drive_inbox_file_name}
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[clip.status]}`}
                  >
                    {clip.status}
                  </span>
                  {clip.status !== 'cleaned' ? (
                    <button
                      type="button"
                      className="shrink-0 rounded p-0.5 text-neutral-300 hover:bg-rose-50 hover:text-rose-500"
                      title="Remove from list"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeClipRow(clip)
                      }}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  ) : null}
                </div>
                <div className="mt-0.5 text-xs text-neutral-400">
                  {new Date(clip.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                  {' · '}
                  {fmtDuration(clip.duration_in_sec)}
                  {clip.duration_out_sec != null
                    ? ` → ${fmtDuration(clip.duration_out_sec)}`
                    : ''}
                  {clip.cuts_filler_count != null || clip.cuts_silence_count != null
                    ? ` · ${clip.cuts_filler_count ?? 0} filler / ${clip.cuts_silence_count ?? 0} silence`
                    : ''}
                </div>
                {clip.status === 'failed' && clip.error ? (
                  <div className="mt-1 truncate text-xs text-rose-500" title={clip.error}>
                    {clip.error}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>

        {/* Player for the selected final */}
        {selected?.cleaned_file_id ? (
          <div className="flex flex-col gap-2">
            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-black">
              <iframe
                key={selected.id}
                src={`https://drive.google.com/file/d/${selected.cleaned_file_id}/preview`}
                className="aspect-video w-full"
                allow="autoplay; fullscreen"
                title={selected.drive_inbox_file_name}
              />
            </div>
            <div className="flex gap-4 text-xs">
              <a
                className="font-medium text-sky-600 hover:underline"
                href={driveFileUrl(selected.cleaned_file_id)}
                target="_blank"
                rel="noreferrer"
              >
                Final in Drive
              </a>
              <a
                className="text-neutral-500 hover:underline"
                href={driveFileUrl(selected.drive_inbox_file_id)}
                target="_blank"
                rel="noreferrer"
              >
                Original
              </a>
              {selected.drive_clip_folder_id ? (
                <a
                  className="text-neutral-500 hover:underline"
                  href={folderUrl(selected.drive_clip_folder_id)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Folder
                </a>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-2xl border border-dashed border-neutral-200 text-sm text-neutral-400">
            Select a ready video to play it here
          </div>
        )}
      </div>
    </section>
  )
}
