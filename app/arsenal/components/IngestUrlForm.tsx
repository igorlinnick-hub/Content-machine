'use client'

import { useState } from 'react'
import type { QueueRow } from '@/lib/arsenal/store'

interface IngestUrlFormProps {
  clinicId: string
  onQueued: (row: QueueRow) => void
}

export function IngestUrlForm({ clinicId, onQueued }: IngestUrlFormProps) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!url.trim()) return
    setBusy(true)
    setMsg(null)
    setErr(null)
    try {
      const res = await fetch('/api/arsenal/ingest-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clinicId, url: url.trim() }),
      })
      const payload = (await res.json()) as {
        ok?: boolean
        reused?: boolean
        queue?: QueueRow
        error?: string
      }
      if (!res.ok || !payload.ok || !payload.queue) {
        setErr(payload.error ?? `request failed (${res.status})`)
        return
      }
      onQueued(payload.queue)
      setMsg(
        payload.reused
          ? `Already in queue (${payload.queue.status})`
          : 'Queued. Run the local skill to process.'
      )
      setUrl('')
    } catch (e) {
      const m = e instanceof Error ? e.message : 'network error'
      setErr(m)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4"
    >
      <label className="text-sm font-medium text-neutral-700">
        Add reference video
      </label>
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.instagram.com/reel/…"
          className="cm-input flex-1"
          disabled={busy}
          required
        />
        <button
          type="submit"
          disabled={busy}
          className="cm-btn cm-btn-primary text-sm"
        >
          {busy ? 'Queueing…' : 'Queue'}
        </button>
      </div>
      <p className="text-xs text-neutral-500">
        Same code path as pasting in Telegram. Supports Instagram, YouTube,
        TikTok, Twitter/X.
      </p>
      {msg && <p className="text-xs text-emerald-600">{msg}</p>}
      {err && <p className="text-xs text-rose-600">{err}</p>}
    </form>
  )
}
