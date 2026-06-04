/* eslint-disable @next/next/no-img-element */
'use client'

import { useEffect, useState } from 'react'

interface Pick {
  drive_file_id: string
  score: number
  reason: string
}

interface Candidate {
  drive_file_id: string
  file_name: string | null
  description: string
  tags: string[]
}

interface RecommendResponse {
  picks: Pick[]
  candidates: Candidate[]
  reason?: string
}

interface Props {
  clinicId: string
  slideSetId: string
  slideIndex: number
  driveFolderId: string | null
  // Optional explicit current override (for highlight). Caller passes
  // the file_id currently in slide_sets.photo_overrides[slideIndex].
  currentFileId: string | null
  onClose: () => void
  // Fires after a successful override write. Caller should refetch the
  // post detail / preview to pick up the new photo.
  onPicked: () => void
}

// Modal that opens from the slide preview's "📷 Change photo" button.
// Two panes: recommended picks (with reasons) on top, all indexed
// photos in a grid below. "Re-index folder" pulls fresh descriptions
// for new uploads.
export function PhotoPicker({
  clinicId,
  slideSetId,
  slideIndex,
  driveFolderId,
  currentFileId,
  onClose,
  onPicked,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [picks, setPicks] = useState<Pick[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [reason, setReason] = useState<string | null>(null)
  const [indexing, setIndexing] = useState(false)
  const [indexMsg, setIndexMsg] = useState<string | null>(null)
  const [picking, setPicking] = useState<string | null>(null)

  async function loadRecommendations() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/visual/photo-recommend', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slideSetId, slideIndex, topN: 5 }),
      })
      const data = (await res.json()) as RecommendResponse & { error?: string }
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      setPicks(data.picks ?? [])
      setCandidates(data.candidates ?? [])
      setReason(data.reason ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load recommendations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadRecommendations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideSetId, slideIndex])

  async function reindex() {
    if (!driveFolderId) return
    setIndexing(true)
    setIndexMsg(null)
    try {
      const res = await fetch('/api/visual/photo-index', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clinicId, driveFolderId, limit: 20 }),
      })
      const data = (await res.json()) as {
        indexed: number
        skipped: number
        total: number
        remaining?: number
        error?: string
      }
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      setIndexMsg(
        `Indexed ${data.indexed} new / ${data.total} total${
          data.remaining ? ` · ${data.remaining} remaining` : ''
        }`
      )
      await loadRecommendations()
    } catch (e) {
      setIndexMsg(e instanceof Error ? e.message : 'index failed')
    } finally {
      setIndexing(false)
    }
  }

  async function pick(fileId: string | null) {
    setPicking(fileId ?? '__clear__')
    try {
      const res = await fetch('/api/visual/photo-override', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slideSetId, slideIndex, driveFileId: fileId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      onPicked()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to apply pick')
    } finally {
      setPicking(null)
    }
  }

  // Lookup map: drive_file_id → candidate. So we can render thumbnails
  // and descriptions for picks without a second source of truth.
  const byId = new Map(candidates.map((c) => [c.drive_file_id, c]))
  const otherCandidates = candidates.filter(
    (c) => !picks.some((p) => p.drive_file_id === c.drive_file_id)
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-4xl rounded-lg bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-sky-500">
              Slide {slideIndex + 1}
            </p>
            <h2 className="text-lg font-semibold text-neutral-900">
              Change photo
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={reindex}
              disabled={indexing || !driveFolderId}
              className="cm-btn cm-btn-ghost text-xs"
              title={
                driveFolderId
                  ? 'Describe newly-added photos in the Drive folder'
                  : 'No Drive folder linked'
              }
            >
              {indexing ? 'Indexing…' : '↻ Re-index folder'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="cm-btn cm-btn-ghost text-xs"
            >
              Close
            </button>
          </div>
        </div>

        <div className="space-y-5 px-5 py-4">
          {indexMsg && (
            <p className="rounded border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs text-sky-800">
              {indexMsg}
            </p>
          )}
          {error && (
            <p className="rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
              {error}
            </p>
          )}

          {loading && (
            <p className="py-4 text-center text-sm text-neutral-500">
              Loading recommendations…
            </p>
          )}

          {!loading && reason === 'no_photos_indexed' && (
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
              <p className="mb-1 font-medium">No photos indexed yet</p>
              <p className="text-xs">
                Click <strong>↻ Re-index folder</strong> above to describe the
                photos in this clinic&apos;s Drive folder. After that you&apos;ll
                see smart recommendations per slide.
              </p>
            </div>
          )}

          {!loading && picks.length > 0 && (
            <section>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                Recommended for this slide
              </h3>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {picks.map((p) => {
                  const c = byId.get(p.drive_file_id)
                  return (
                    <PhotoCard
                      key={p.drive_file_id}
                      fileId={p.drive_file_id}
                      description={c?.description ?? ''}
                      reason={p.reason}
                      score={p.score}
                      selected={p.drive_file_id === currentFileId}
                      busy={picking === p.drive_file_id}
                      onPick={() => pick(p.drive_file_id)}
                    />
                  )
                })}
              </div>
            </section>
          )}

          {!loading && otherCandidates.length > 0 && (
            <section>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                All photos in folder ({otherCandidates.length})
              </h3>
              <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
                {otherCandidates.map((c) => (
                  <PhotoCard
                    key={c.drive_file_id}
                    fileId={c.drive_file_id}
                    description={c.description}
                    reason={null}
                    score={null}
                    selected={c.drive_file_id === currentFileId}
                    busy={picking === c.drive_file_id}
                    compact
                    onPick={() => pick(c.drive_file_id)}
                  />
                ))}
              </div>
            </section>
          )}

          {currentFileId && (
            <div className="flex justify-end border-t border-neutral-100 pt-3">
              <button
                type="button"
                onClick={() => pick(null)}
                disabled={picking === '__clear__'}
                className="cm-btn cm-btn-ghost text-xs"
              >
                {picking === '__clear__'
                  ? 'Clearing…'
                  : '↺ Revert to auto-cycle'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface PhotoCardProps {
  fileId: string
  description: string
  reason: string | null
  score: number | null
  selected: boolean
  busy: boolean
  compact?: boolean
  onPick: () => void
}

function PhotoCard({
  fileId,
  description,
  reason,
  score,
  selected,
  busy,
  compact,
  onPick,
}: PhotoCardProps) {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={busy}
      className={`group flex flex-col overflow-hidden rounded-md border text-left transition ${
        selected
          ? 'border-sky-500 ring-2 ring-sky-300'
          : 'border-neutral-200 hover:border-sky-300'
      } ${busy ? 'opacity-60' : ''}`}
    >
      <div className="aspect-[4/5] w-full overflow-hidden bg-neutral-100">
        <img
          src={`/api/visual/photo-thumb/${fileId}`}
          alt={description}
          loading="lazy"
          className="h-full w-full object-cover transition group-hover:scale-[1.02]"
        />
      </div>
      <div className={`flex flex-col gap-1 ${compact ? 'p-2' : 'p-2.5'}`}>
        {score !== null && reason && (
          <p className="text-[10px] font-medium leading-snug text-emerald-700">
            {reason}
          </p>
        )}
        {!compact && (
          <p className="line-clamp-2 text-[11px] leading-snug text-neutral-700">
            {description}
          </p>
        )}
      </div>
    </button>
  )
}
