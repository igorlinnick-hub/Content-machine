'use client'

import { useEffect, useRef, useState } from 'react'

// ============================================================
// Notes — the idea scratchpad next to Generate.
//
// The deal (Igor 2026-09-23): you dump ideas in any shape — typed or
// photographed off paper — and the AI only cleans mechanics (spelling,
// grammar, light grouping). It never touches the ideas themselves, and
// the raw original is always one toggle away ("Original" / revert).
// ============================================================

interface IdeaNote {
  id: string
  title: string | null
  body: string
  raw_body: string
  source: 'typed' | 'photo'
  tidy_status: 'raw' | 'tidied' | 'failed'
  tidy_flags: string[]
  image_urls: string[]
  pinned: boolean
  archived: boolean
  created_at: string
  updated_at: string
}

interface Props {
  clinicId: string
}

type ComposerStatus = 'idle' | 'saving' | 'error'

export function NotesWorkspace({ clinicId }: Props) {
  const [notes, setNotes] = useState<IdeaNote[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState<ComposerStatus>('idle')
  const [composerError, setComposerError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  // Local previews of the pages currently being read — rendered as a
  // live card at the top of the list, so the 10-30 s the vision pass
  // takes never look like "nothing happened" (Igor 2026-09-23).
  const [processingUrls, setProcessingUrls] = useState<string[] | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/notes/ideas?clinicId=${clinicId}`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
        if (!cancelled) setNotes(data.notes as IdeaNote[])
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'failed to load')
      })
    return () => {
      cancelled = true
    }
  }, [clinicId])

  function upsertNote(note: IdeaNote) {
    setNotes((prev) => {
      const rest = (prev ?? []).filter((n) => n.id !== note.id)
      const next = note.archived ? rest : [note, ...rest]
      // Keep pinned block on top, freshest first inside each block —
      // same order the server returns.
      return next.sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) ||
          b.updated_at.localeCompare(a.updated_at)
      )
    })
  }

  async function saveTyped() {
    const rawText = draft.trim()
    if (!rawText) return
    setStatus('saving')
    setComposerError(null)
    try {
      const res = await fetch('/api/notes/ideas', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clinicId, rawText }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      upsertNote(data.note as IdeaNote)
      setDraft('')
      setStatus('idle')
    } catch (e) {
      setStatus('error')
      setComposerError(e instanceof Error ? e.message : 'unknown error')
    }
  }

  async function uploadPhotos(files: FileList | null) {
    if (!files || files.length === 0) return
    const picked = Array.from(files).slice(0, 4)
    const previews = picked.map((f) => URL.createObjectURL(f))
    setUploading(true)
    setProcessingUrls(previews)
    setComposerError(null)
    try {
      const form = new FormData()
      form.set('clinicId', clinicId)
      picked.forEach((f) => form.append('files', f))
      const res = await fetch('/api/notes/ideas/photo', {
        method: 'POST',
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      upsertNote(data.note as IdeaNote)
    } catch (e) {
      setComposerError(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setUploading(false)
      setProcessingUrls(null)
      previews.forEach((u) => URL.revokeObjectURL(u))
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Composer */}
      <div className="cm-card flex flex-col gap-3 p-5">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          placeholder="Dump ideas as they come — any order, any language, typos welcome. AI fixes the grammar and sorts the pile; it never touches the ideas themselves."
          className="cm-input text-sm"
          disabled={status === 'saving'}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              multiple
              className="hidden"
              onChange={(e) => uploadPhotos(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading || status === 'saving'}
              className="cm-btn text-sm"
              title="Photograph a paper note — AI reads it into text"
            >
              {uploading ? 'Reading the page…' : '📷 Snap a paper note'}
            </button>
            {composerError && (
              <p className="text-xs text-red-500">{composerError}</p>
            )}
          </div>
          <button
            type="button"
            onClick={saveTyped}
            disabled={!draft.trim() || status === 'saving'}
            className="cm-btn cm-btn-primary text-sm"
          >
            {status === 'saving' ? 'Organizing…' : 'Save note'}
          </button>
        </div>
      </div>

      {/* List */}
      {processingUrls && <ProcessingCard urls={processingUrls} />}
      {loadError && <p className="text-sm text-red-500">{loadError}</p>}
      {notes === null && !loadError && (
        <p className="text-sm text-neutral-400">Loading notes…</p>
      )}
      {notes?.length === 0 && !processingUrls && (
        <p className="text-sm text-neutral-500">
          No notes yet. Type one above, or photograph the page you scribbled
          on — it lands here organized, with the original kept.
        </p>
      )}
      {notes?.map((note) => (
        <NoteCard key={note.id} note={note} onChange={upsertNote} onRemoved={(id) => setNotes((prev) => (prev ?? []).filter((n) => n.id !== id))} />
      ))}
    </div>
  )
}

// The stages are cosmetic — it is one request — but naming what the
// machine is doing right now reads as progress, and the shimmer makes
// it unmistakable that the app is working, not stuck.
const PROCESSING_STAGES = [
  'Uploading the photo…',
  'Reading the page…',
  'Transcribing your handwriting…',
  'Organizing the ideas…',
  'Almost there…',
]

function ProcessingCard({ urls }: { urls: string[] }) {
  const [stage, setStage] = useState(0)

  useEffect(() => {
    const id = setInterval(
      () => setStage((v) => Math.min(v + 1, PROCESSING_STAGES.length - 1)),
      4500
    )
    return () => clearInterval(id)
  }, [])

  return (
    <article className="cm-card flex items-center gap-4 border-sky-200 bg-sky-50/60 p-5">
      <div className="flex shrink-0 -space-x-3">
        {urls.map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={url}
            src={url}
            alt=""
            style={{ animationDelay: `${i * 150}ms` }}
            className="h-16 w-16 animate-pulse rounded-lg border-2 border-white object-cover shadow-sm"
          />
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
          <svg
            className="h-4 w-4 shrink-0 animate-spin text-sky-500"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
            <path
              d="M12 2a10 10 0 0 1 10 10"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
          {PROCESSING_STAGES[stage]}
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Takes up to half a minute — the AI is reading the page word for
          word. The note will appear right here.
        </p>
      </div>
    </article>
  )
}

function NoteCard({
  note,
  onChange,
  onRemoved,
}: {
  note: IdeaNote
  onChange: (note: IdeaNote) => void
  onRemoved: (noteId: string) => void
}) {
  const [showRaw, setShowRaw] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function patch(body: Record<string, unknown>) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/notes/ideas', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ noteId: note.id, ...body }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      onChange(data.note as IdeaNote)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!window.confirm('Delete this note? The original text and photos go with it.')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/notes/ideas?noteId=${note.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data?.error ?? `HTTP ${res.status}`)
      }
      onRemoved(note.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown error')
      setBusy(false)
    }
  }

  const displayText = showRaw ? note.raw_body : note.body

  return (
    <article className={`cm-card flex flex-col gap-3 p-5 ${busy ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-neutral-900">
            {note.pinned && <span title="Pinned">📌 </span>}
            {note.title ?? 'Untitled note'}
          </h3>
          <p className="mt-0.5 text-xs text-neutral-400">
            {new Date(note.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
            {note.source === 'photo' && ' · 📷 from paper'}
            {note.tidy_status === 'failed' && ' · organizer failed — showing your raw text'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {note.tidy_status === 'tidied' && (
            <button
              type="button"
              onClick={() => setShowRaw((v) => !v)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                showRaw
                  ? 'bg-amber-100 text-amber-700'
                  : 'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600'
              }`}
              title="Toggle between the organized version and exactly what you wrote"
            >
              {showRaw ? 'Original' : 'View original'}
            </button>
          )}
          <IconButton label={note.pinned ? 'Unpin' : 'Pin'} onClick={() => patch({ pinned: !note.pinned })}>
            📌
          </IconButton>
          <IconButton
            label="Edit"
            onClick={() => {
              setEditText(note.body)
              setEditing(true)
              setShowRaw(false)
            }}
          >
            ✏️
          </IconButton>
          <IconButton label="Delete" onClick={remove}>
            🗑
          </IconButton>
        </div>
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={Math.min(16, Math.max(4, editText.split('\n').length + 1))}
            className="cm-input text-sm"
          />
          <div className="flex items-center justify-end gap-2">
            <button type="button" className="cm-btn text-sm" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="cm-btn cm-btn-primary text-sm"
              disabled={!editText.trim() || busy}
              onClick={async () => {
                await patch({ body: editText.trim() })
                setEditing(false)
              }}
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`whitespace-pre-wrap text-sm leading-relaxed ${
            showRaw ? 'rounded-xl bg-amber-50 p-3 text-neutral-700' : 'text-neutral-800'
          }`}
        >
          {displayText}
        </div>
      )}

      {note.image_urls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {note.image_urls.map((url) => (
            <a key={url} href={url} target="_blank" rel="noreferrer" title="Open the photographed page">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt="Photographed note page"
                className="h-16 w-16 rounded-lg border border-neutral-200 object-cover"
              />
            </a>
          ))}
        </div>
      )}

      {note.tidy_flags.length > 0 && !showRaw && !editing && (
        <div className="rounded-xl bg-neutral-50 px-3 py-2">
          <p className="text-xs font-medium text-neutral-500">
            What the organizer wasn&apos;t sure about:
          </p>
          <ul className="mt-1 list-disc pl-4 text-xs text-neutral-500">
            {note.tidy_flags.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </article>
  )
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="rounded-lg px-2 py-1 text-sm text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
    >
      {children}
    </button>
  )
}
