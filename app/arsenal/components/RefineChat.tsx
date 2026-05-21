'use client'

import { useEffect, useRef, useState } from 'react'
import type { DecoratedArsenalRow } from './types'

interface RefineChatProps {
  arsenalId: string
  clinicId: string
  pendingNote: string | null
  onUpdated: (patch: Partial<DecoratedArsenalRow>) => void
}

// When the operator types "разверни про b-roll подробнее" we POST the
// note to /api/arsenal/[id]/refine which sets pending_refine_note. The
// local skill polls, applies, then clears the note. We poll the row
// here to surface the update as soon as it lands — no websocket.
const POLL_INTERVAL_MS = 8000

export function RefineChat({
  arsenalId,
  clinicId,
  pendingNote,
  onUpdated,
}: RefineChatProps) {
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [currentPending, setCurrentPending] = useState<string | null>(pendingNote)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setCurrentPending(pendingNote)
  }, [pendingNote])

  // Poll only while we know a note is queued — once the skill clears
  // it we stop tapping the API. Eliminates the "polls forever, even
  // for idle cards" footgun.
  useEffect(() => {
    if (!currentPending) return
    timer.current = setInterval(() => {
      void (async () => {
        try {
          const res = await fetch(
            `/api/arsenal/${arsenalId}?clinicId=${clinicId}`,
            { cache: 'no-store' }
          )
          if (!res.ok) return
          const payload = (await res.json()) as {
            row?: DecoratedArsenalRow
            video_url?: string | null
            thumbnail_url?: string | null
          }
          if (!payload.row) return
          onUpdated({
            ...payload.row,
            video_url: payload.video_url ?? null,
            thumbnail_url: payload.thumbnail_url ?? null,
          })
          if (payload.row.pending_refine_note === null) {
            setCurrentPending(null)
          }
        } catch {
          // network blip — keep polling
        }
      })()
    }, POLL_INTERVAL_MS)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [currentPending, arsenalId, clinicId, onUpdated])

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!note.trim()) return
    setSending(true)
    setErr(null)
    try {
      const res = await fetch(`/api/arsenal/${arsenalId}/refine`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clinicId, note: note.trim() }),
      })
      const payload = (await res.json()) as {
        ok?: boolean
        row?: DecoratedArsenalRow
        error?: string
      }
      if (!res.ok || !payload.ok) {
        setErr(payload.error ?? `request failed (${res.status})`)
        return
      }
      setCurrentPending(note.trim())
      if (payload.row) onUpdated(payload.row)
      setNote('')
    } catch (e) {
      const m = e instanceof Error ? e.message : 'network error'
      setErr(m)
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label className="text-xs font-medium text-neutral-700">
        Ask the archivist to refine this entry
      </label>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. разверни про b-roll подробнее · перегенери хуки с фокусом на колени · добавь ещё боли"
        className="cm-input min-h-[60px] resize-y text-sm"
        disabled={sending}
      />
      <div className="flex items-center justify-between gap-2">
        <button
          type="submit"
          disabled={sending || !note.trim()}
          className="cm-btn cm-btn-primary text-xs"
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
        {currentPending && (
          <span className="text-xs italic text-amber-700">
            Pending — &ldquo;{currentPending}&rdquo; (the skill will pick it up)
          </span>
        )}
      </div>
      {err && <p className="text-xs text-rose-600">{err}</p>}
    </form>
  )
}
