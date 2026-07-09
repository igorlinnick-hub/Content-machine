'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

// Admin work queue for doctor recordings (HANDOFF §22.2 п.11 v2):
// the editor scrolls the list, previews each video in-app (Drive
// embed), deletes rejects (Drive file included) and runs Auto-edit
// on the keepers. The doctor's surface ends at "upload".

export interface RecordingRow {
  id: string
  title: string
  drive_file_id: string
  duration_sec: number | null
  size_bytes: number | null
  created_at: string
}

type EditState = 'idle' | 'running' | 'done' | 'error'

function fmtDuration(sec: number | null): string {
  if (sec == null) return '—'
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return ''
  return `${(bytes / 1024 / 1024).toFixed(0)} MB`
}

export default function RecordingsPanel({
  clinicId,
  recordings,
}: {
  clinicId: string
  recordings: RecordingRow[]
}) {
  const router = useRouter()
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string | null>(
    recordings[0]?.id ?? null
  )
  const [editState, setEditState] = useState<Record<string, EditState>>({})
  const [error, setError] = useState<string | null>(null)

  const visible = useMemo(
    () => recordings.filter((r) => !removed.has(r.id)),
    [recordings, removed]
  )
  const selected = visible.find((r) => r.id === selectedId) ?? visible[0] ?? null

  async function runAutoEdit(rec: RecordingRow) {
    if (editState[rec.id] === 'running') return
    setEditState((s) => ({ ...s, [rec.id]: 'running' }))
    setError(null)
    try {
      const res = await fetch('/api/clips/from-recording', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordingId: rec.id }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(body.error ?? `auto-edit failed (${res.status})`)
      setEditState((s) => ({ ...s, [rec.id]: 'done' }))
      // Pull the fresh clip row into the table below.
      router.refresh()
    } catch (e) {
      setEditState((s) => ({ ...s, [rec.id]: 'error' }))
      setError(e instanceof Error ? e.message : 'auto-edit failed')
    }
  }

  async function deleteRecording(rec: RecordingRow) {
    if (!window.confirm(`Delete "${rec.title}"? The file is removed from Google Drive too.`)) {
      return
    }
    setError(null)
    try {
      const res = await fetch('/api/studio/recordings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordingId: rec.id }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `delete failed (${res.status})`)
      }
      setRemoved((s) => new Set(s).add(rec.id))
      if (selectedId === rec.id) setSelectedId(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'delete failed')
    }
  }

  if (visible.length === 0) {
    return (
      <section>
        <h2 className="text-sm font-semibold text-neutral-900">Recordings</h2>
        <p className="mt-2 text-sm text-neutral-500">
          No recordings waiting. Teleprompter uploads land here.
        </p>
      </section>
    )
  }

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-neutral-900">
          Recordings{' '}
          <span className="font-normal text-neutral-400">({visible.length})</span>
        </h2>
        <p className="text-xs text-neutral-400">
          Preview → Auto-edit the keepers, delete the rest
        </p>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(260px,340px)_1fr]">
        {/* Scrollable list */}
        <div className="max-h-[420px] overflow-y-auto rounded-2xl border border-neutral-200 bg-white">
          {visible.map((rec) => {
            const state = editState[rec.id] ?? 'idle'
            const active = selected?.id === rec.id
            return (
              <div
                key={rec.id}
                className={`flex cursor-pointer items-center gap-3 border-b border-neutral-100 px-3 py-2.5 last:border-0 ${
                  active ? 'bg-violet-50' : 'hover:bg-neutral-50'
                }`}
                onClick={() => setSelectedId(rec.id)}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-neutral-800" title={rec.title}>
                    {rec.title}
                  </div>
                  <div className="text-xs text-neutral-400">
                    {new Date(rec.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}{' '}
                    · {fmtDuration(rec.duration_sec)}
                    {rec.size_bytes ? ` · ${fmtSize(rec.size_bytes)}` : ''}
                  </div>
                </div>
                {state === 'done' ? (
                  <span className="shrink-0 text-xs font-medium text-emerald-600">Edited</span>
                ) : state === 'running' ? (
                  <span className="shrink-0 text-xs font-medium text-violet-600">editing…</span>
                ) : (
                  <button
                    type="button"
                    className="shrink-0 rounded-lg p-1.5 text-neutral-300 hover:bg-rose-50 hover:text-rose-500"
                    title="Delete (also removes from Drive)"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteRecording(rec)
                    }}
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

        {/* Preview + actions for the selected recording */}
        {selected ? (
          <div className="flex flex-col gap-2">
            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-black">
              <iframe
                key={selected.id}
                src={`https://drive.google.com/file/d/${selected.drive_file_id}/preview`}
                className="aspect-video w-full"
                allow="autoplay; fullscreen"
                title={selected.title}
              />
            </div>
            <div className="flex items-center gap-2">
              {(editState[selected.id] ?? 'idle') === 'running' ? (
                <div className="flex items-center gap-2 rounded-2xl border border-violet-100 bg-violet-50 px-4 py-2.5 text-sm font-medium text-violet-700">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
                  Editing… usually 2–4 min
                </div>
              ) : (editState[selected.id] ?? 'idle') === 'done' ? (
                <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
                  Cleaned — see the clip in the table below
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => runAutoEdit(selected)}
                  className="cm-btn cm-btn-primary rounded-2xl px-5 py-2.5 text-sm font-semibold"
                >
                  Auto-edit
                </button>
              )}
              <span className="text-xs text-neutral-400">
                Cuts retakes, fillers &amp; silences, burns the clinic&apos;s
                caption style
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {error && <p className="mt-2 text-xs text-rose-500">{error}</p>}
    </section>
  )
}
