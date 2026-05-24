'use client'

import { useState } from 'react'
import type { QueueRow } from '@/lib/arsenal/store'

interface IngestUrlFormProps {
  clinicId: string
  onQueued: (row: QueueRow) => void
}

type Mode = 'url' | 'upload'

// Two-mode ingest panel:
//   - URL: paste an IG/YT/TikTok link (same path as the TG webhook).
//   - Upload: drag-and-drop or pick an mp4 from disk. We request a
//     signed Supabase Storage URL from /api/arsenal/upload-url, PUT
//     the bytes directly to the bucket (no Vercel pass-through —
//     keeps the serverless function payload tiny), then POST the
//     resulting storage path to /api/arsenal/ingest-upload to
//     create the queue row.
//
// A free-form "question / brief" textarea is shared between both
// modes — populating it tags the queue row intent=template_for_clinic
// so the local skill additionally drafts a clinic-tailored template
// scaffold alongside the plain extraction.

const MAX_UPLOAD_MB = 200
const QUEUE_HINT_PREFIX = 'upload'

function makeUploadHint(): string {
  // Browser-side random id used to namespace the storage path BEFORE
  // an arsenal row exists. The path persists into script_arsenal once
  // the skill posts /api/arsenal/draft.
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 12)
      : Math.random().toString(36).slice(2, 14)
  return `${QUEUE_HINT_PREFIX}_${rand}`
}

export function IngestUrlForm({ clinicId, onQueued }: IngestUrlFormProps) {
  const [mode, setMode] = useState<Mode>('url')
  const [url, setUrl] = useState('')
  const [question, setQuestion] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  function reset(): void {
    setUrl('')
    setQuestion('')
    setFile(null)
    setProgress(null)
  }

  async function submitUrl(): Promise<void> {
    if (!url.trim()) return
    const res = await fetch('/api/arsenal/ingest-url', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        clinicId,
        url: url.trim(),
        userContext: question.trim() || undefined,
      }),
    })
    const payload = (await res.json()) as {
      ok?: boolean
      reused?: boolean
      upgraded?: boolean
      queue?: QueueRow
      error?: string
    }
    if (!res.ok || !payload.ok || !payload.queue) {
      setErr(payload.error ?? `request failed (${res.status})`)
      return
    }
    onQueued(payload.queue)
    const tag = payload.queue.intent === 'template_for_clinic'
      ? ' (template proposal)'
      : ''
    setMsg(
      payload.upgraded
        ? `Question attached to existing pending row${tag}`
        : payload.reused
          ? `Already in queue (${payload.queue.status})`
          : `Queued${tag}. Local skill will pick it up.`
    )
    reset()
  }

  async function submitUpload(): Promise<void> {
    if (!file) return
    const sizeMb = file.size / (1024 * 1024)
    if (sizeMb > MAX_UPLOAD_MB) {
      setErr(`File too large (${sizeMb.toFixed(1)} MB > ${MAX_UPLOAD_MB} MB max)`)
      return
    }
    const hint = makeUploadHint()
    setProgress(0)
    // 1. Get signed upload URLs
    const targetRes = await fetch(
      `/api/arsenal/upload-url?clinic_id=${encodeURIComponent(clinicId)}&queue_id=${encodeURIComponent(hint)}`
    )
    const targetPayload = (await targetRes.json()) as {
      ok?: boolean
      videoPath?: string
      videoSignedUrl?: string
      error?: string
    }
    if (!targetRes.ok || !targetPayload.ok || !targetPayload.videoSignedUrl) {
      setErr(targetPayload.error ?? `signed URL failed (${targetRes.status})`)
      return
    }
    setProgress(15)
    // 2. PUT the bytes straight to Supabase Storage. fetch() doesn't
    //    expose upload progress, but we surface a coarse 15→90 jump on
    //    completion which is honest enough for one-shot uploads.
    const putRes = await fetch(targetPayload.videoSignedUrl, {
      method: 'PUT',
      headers: { 'content-type': file.type || 'video/mp4' },
      body: file,
    })
    if (!putRes.ok) {
      setErr(`upload failed (${putRes.status})`)
      return
    }
    setProgress(90)
    // 3. Enqueue with the resulting path
    const enqueueRes = await fetch('/api/arsenal/ingest-upload', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        clinicId,
        videoPath: targetPayload.videoPath,
        userContext: question.trim() || undefined,
        displayLabel: file.name,
      }),
    })
    const enqueuePayload = (await enqueueRes.json()) as {
      ok?: boolean
      queue?: QueueRow
      error?: string
    }
    if (!enqueueRes.ok || !enqueuePayload.ok || !enqueuePayload.queue) {
      setErr(enqueuePayload.error ?? `enqueue failed (${enqueueRes.status})`)
      return
    }
    setProgress(100)
    onQueued(enqueuePayload.queue)
    const tag = enqueuePayload.queue.intent === 'template_for_clinic'
      ? ' (template proposal)'
      : ''
    setMsg(`Uploaded ${file.name} → queued${tag}. Local skill picks it up.`)
    reset()
  }

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    setErr(null)
    try {
      if (mode === 'url') await submitUrl()
      else await submitUpload()
    } catch (e) {
      const m = e instanceof Error ? e.message : 'network error'
      setErr(m)
    } finally {
      setBusy(false)
    }
  }

  function onDrop(e: React.DragEvent): void {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) setFile(dropped)
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4"
    >
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-neutral-700">
          Add reference video
        </label>
        <div className="inline-flex rounded-md border border-neutral-200 bg-neutral-50 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setMode('url')}
            className={`rounded px-2 py-1 transition ${
              mode === 'url'
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            🔗 URL
          </button>
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={`rounded px-2 py-1 transition ${
              mode === 'upload'
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            📁 Upload
          </button>
        </div>
      </div>

      {mode === 'url' ? (
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.instagram.com/reel/…"
          className="cm-input"
          disabled={busy}
          required={mode === 'url'}
        />
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed p-3 text-center text-xs transition ${
            dragging
              ? 'border-violet-400 bg-violet-50 text-violet-700'
              : 'border-neutral-300 bg-neutral-50 text-neutral-500'
          }`}
        >
          {file ? (
            <>
              <span className="font-mono text-sm text-neutral-900">
                {file.name}
              </span>
              <span>
                {(file.size / (1024 * 1024)).toFixed(1)} MB
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="ml-2 text-rose-600 hover:underline"
                >
                  remove
                </button>
              </span>
            </>
          ) : (
            <>
              <span>Drag &amp; drop an mp4 here, or</span>
              <label className="cursor-pointer rounded bg-white px-2 py-1 font-medium text-violet-600 hover:bg-violet-100">
                <input
                  type="file"
                  accept="video/mp4,video/quicktime,video/*"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                Choose file
              </label>
              <span className="text-[11px] text-neutral-400">
                Up to {MAX_UPLOAD_MB} MB
              </span>
            </>
          )}
        </div>
      )}

      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Optional: question / brief — e.g. &quot;describe structure + how this could be a template for our clinic&quot;"
        className="cm-input min-h-[60px] resize-y text-sm"
        rows={2}
        disabled={busy}
      />

      <div className="flex items-center justify-between">
        <p className="text-xs text-neutral-500">
          {mode === 'url'
            ? 'IG / YouTube / TikTok / Twitter. Same path as TG.'
            : 'Bytes go straight to Supabase Storage.'}{' '}
          With a question → tagged{' '}
          <code className="rounded bg-neutral-100 px-1 text-[11px]">
            template_for_clinic
          </code>
          .
        </p>
        <button
          type="submit"
          disabled={busy || (mode === 'upload' && !file) || (mode === 'url' && !url)}
          className="cm-btn cm-btn-primary text-sm"
        >
          {busy
            ? mode === 'upload' && progress !== null
              ? `Uploading… ${progress}%`
              : 'Queueing…'
            : 'Queue'}
        </button>
      </div>

      {msg && <p className="text-xs text-emerald-600">{msg}</p>}
      {err && <p className="text-xs text-rose-600">{err}</p>}
    </form>
  )
}
