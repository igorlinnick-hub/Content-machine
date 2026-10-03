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

interface TidyIssue {
  text: string
  options: string[]
  note?: string
}

interface IdeaNote {
  id: string
  title: string | null
  body: string
  raw_body: string
  source: 'typed' | 'photo' | 'voice'
  tidy_status: 'raw' | 'tidied' | 'failed'
  tidy_flags: string[]
  tidy_issues: TidyIssue[]
  image_urls: string[]
  audio_url: string | null
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
  // 'voice' renders the same live card without thumbnails while the
  // recording is transcribed.
  const [processingKind, setProcessingKind] = useState<'photo' | 'voice'>('photo')
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const recorder = useRef<MediaRecorder | null>(null)
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  // Tap-stop resolves to "send"; the ✕ sets this so onstop discards.
  const discardRecording = useRef(false)
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
    setProcessingKind('photo')
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

  async function startRecording() {
    setComposerError(null)
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setComposerError('microphone access denied — allow it in the browser settings')
      return
    }
    // Safari/iPhone records mp4/AAC, Chrome webm/opus — take whichever
    // this browser can actually produce and tell the server honestly.
    const mime = ['audio/mp4', 'audio/webm'].find((t) =>
      typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)
    )
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop())
      if (recordTimer.current) clearInterval(recordTimer.current)
      setRecording(false)
      setRecordSeconds(0)
      if (discardRecording.current) return
      const blob = new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' })
      void uploadVoice(blob)
    }
    discardRecording.current = false
    recorder.current = rec
    setRecording(true)
    setRecordSeconds(0)
    recordTimer.current = setInterval(
      () =>
        setRecordSeconds((v) => {
          // Hard stop at 10 min — matches the route's 20 MB ceiling.
          if (v + 1 >= 600 && recorder.current?.state === 'recording') {
            recorder.current.stop()
          }
          return v + 1
        }),
      1000
    )
    rec.start()
  }

  function stopRecording(discard: boolean) {
    discardRecording.current = discard
    if (recorder.current?.state === 'recording') recorder.current.stop()
  }

  async function uploadVoice(blob: Blob) {
    setUploading(true)
    setProcessingKind('voice')
    setProcessingUrls([])
    setComposerError(null)
    try {
      const form = new FormData()
      form.set('clinicId', clinicId)
      form.set('file', new File([blob], 'note', { type: blob.type }))
      const res = await fetch('/api/notes/ideas/audio', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      upsertNote(data.note as IdeaNote)
    } catch (e) {
      setComposerError(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setUploading(false)
      setProcessingUrls(null)
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
            {!recording && (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={uploading || status === 'saving'}
                className="cm-btn text-sm"
                title="Photograph a paper note — AI reads it into text"
              >
                {uploading && processingKind === 'photo' ? 'Reading the page…' : '📷 Snap a paper note'}
              </button>
            )}
            {!recording ? (
              <button
                type="button"
                onClick={startRecording}
                disabled={uploading || status === 'saving'}
                className="cm-btn text-sm"
                title="Say the idea out loud — AI writes it down"
              >
                {uploading && processingKind === 'voice' ? 'Listening back…' : '🎤 Say it'}
              </button>
            ) : (
              <span className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-1.5">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
                <span className="font-mono text-sm tabular-nums text-red-600">
                  {Math.floor(recordSeconds / 60)}:{String(recordSeconds % 60).padStart(2, '0')}
                </span>
                <button
                  type="button"
                  onClick={() => stopRecording(false)}
                  className="cm-btn cm-btn-primary px-3 text-sm"
                >
                  Done
                </button>
                <button
                  type="button"
                  onClick={() => stopRecording(true)}
                  title="Discard the recording"
                  className="rounded-lg px-2 py-1 text-sm text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600"
                >
                  ✕
                </button>
              </span>
            )}
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
      {processingUrls && <ProcessingCard urls={processingUrls} kind={processingKind} />}
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
      {notes && notes.length > 0 && (
        <NotesRibbon
          notes={notes}
          onChange={upsertNote}
          onRemoved={(id) => setNotes((prev) => (prev ?? []).filter((n) => n.id !== id))}
        />
      )}
    </div>
  )
}

// Horizontal snap ribbon (Igor 2026-09-23): notes sit side by side,
// newest first, and you flick between them like dates in a calendar —
// swipe on the phone, ‹ › on desktop. One card fills the phone screen.
function NotesRibbon({
  notes,
  onChange,
  onRemoved,
}: {
  notes: IdeaNote[]
  onChange: (note: IdeaNote) => void
  onRemoved: (noteId: string) => void
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)

  function onScroll() {
    const el = scroller.current
    if (!el || el.children.length === 0) return
    const card = el.children[0] as HTMLElement
    const step = card.offsetWidth + 16 // gap-4
    setIndex(Math.max(0, Math.min(notes.length - 1, Math.round(el.scrollLeft / step))))
  }

  function jump(delta: number) {
    const el = scroller.current
    if (!el || el.children.length === 0) return
    const card = el.children[0] as HTMLElement
    el.scrollBy({ left: delta * (card.offsetWidth + 16), behavior: 'smooth' })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-neutral-400">
        <span>
          {index + 1} / {notes.length} ·{' '}
          {new Date(notes[index]?.updated_at ?? notes[index]?.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
        </span>
        <span className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => jump(-1)}
            disabled={index === 0}
            aria-label="Newer note"
            className="rounded-lg px-2 py-0.5 text-base leading-none text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => jump(1)}
            disabled={index >= notes.length - 1}
            aria-label="Older note"
            className="rounded-lg px-2 py-0.5 text-base leading-none text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30"
          >
            ›
          </button>
        </span>
      </div>
      <div
        ref={scroller}
        onScroll={onScroll}
        className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2"
      >
        {notes.map((note) => (
          <div key={note.id} className="w-[92%] shrink-0 snap-center sm:w-[480px]">
            <NoteCard note={note} onChange={onChange} onRemoved={onRemoved} />
          </div>
        ))}
      </div>
    </div>
  )
}

// The stages are cosmetic — it is one request — but naming what the
// machine is doing right now reads as progress, and the shimmer makes
// it unmistakable that the app is working, not stuck.
const PROCESSING_STAGES = {
  photo: [
    'Uploading the photo…',
    'Reading the page…',
    'Transcribing your handwriting…',
    'Organizing the ideas…',
    'Almost there…',
  ],
  voice: [
    'Uploading the recording…',
    'Listening to it…',
    'Writing down your words…',
    'Organizing the ideas…',
    'Almost there…',
  ],
} as const

function ProcessingCard({ urls, kind }: { urls: string[]; kind: 'photo' | 'voice' }) {
  const stages = PROCESSING_STAGES[kind]
  const [stage, setStage] = useState(0)

  useEffect(() => {
    const id = setInterval(
      () => setStage((v) => Math.min(v + 1, stages.length - 1)),
      4500
    )
    return () => clearInterval(id)
  }, [stages.length])

  return (
    <article className="cm-card flex items-center gap-4 border-sky-200 bg-sky-50/60 p-5">
      {kind === 'voice' && (
        <span className="flex h-16 w-16 shrink-0 animate-pulse items-center justify-center rounded-lg border-2 border-white bg-red-50 text-2xl shadow-sm">
          🎤
        </span>
      )}
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
          {stages[stage]}
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          {kind === 'photo'
            ? 'Takes up to half a minute — the AI is reading the page word for word. The note will appear right here.'
            : 'Takes up to a minute — the AI is writing down every word you said. The note will appear right here.'}
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

  async function patch(body: Record<string, unknown>): Promise<void> {
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
            {note.source === 'voice' && ' · 🎤 spoken'}
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
          className={`max-h-[55vh] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed ${
            showRaw ? 'rounded-xl bg-amber-50 p-3 text-neutral-700' : 'text-neutral-800'
          }`}
        >
          {displayText}
        </div>
      )}

      {note.tidy_issues.length > 0 && !showRaw && !editing && (
        <div className="flex flex-col gap-2 rounded-xl border border-sky-100 bg-sky-50/70 px-3 py-2.5">
          <p className="text-xs font-medium text-neutral-600">
            Not sure about {note.tidy_issues.length === 1 ? 'one word' : `${note.tidy_issues.length} words`} — tap the right one:
          </p>
          {note.tidy_issues.map((issue) => (
            <IssueRow
              key={issue.text}
              issue={issue}
              busy={busy}
              onResolve={(replacement) => {
                const remaining = note.tidy_issues.filter((i) => i.text !== issue.text)
                // First occurrence only — the model guarantees `text` is
                // the exact body spelling, and repeats are near-impossible
                // for a misread word.
                const nextBody =
                  replacement === issue.text
                    ? note.body
                    : note.body.replace(issue.text, replacement)
                return patch({ body: nextBody, tidyIssues: remaining })
              }}
            />
          ))}
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

      {note.audio_url && (
        // The spoken original — same role the photographed page plays:
        // one tap to check what was actually said.
        <audio controls preload="none" src={note.audio_url} className="h-9 w-full" />
      )}

      {note.tidy_flags.length > 0 && !showRaw && !editing && (
        <div className="rounded-xl bg-neutral-50 px-3 py-2">
          <p className="text-xs font-medium text-neutral-500">
            Side notes from reading the page:
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

// One uncertain word: the word, its candidate readings as buttons, a
// pencil for "let me type it", and "keep" to accept it as written.
function IssueRow({
  issue,
  busy,
  onResolve,
}: {
  issue: TidyIssue
  busy: boolean
  onResolve: (replacement: string) => Promise<void> | void
}) {
  const [custom, setCustom] = useState<string | null>(null)

  if (custom !== null) {
    return (
      <div className="flex items-center gap-2">
        <span className="rounded bg-white px-1.5 py-0.5 font-mono text-xs text-neutral-500 line-through">
          {issue.text}
        </span>
        <input
          autoFocus
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && custom.trim()) onResolve(custom.trim())
            if (e.key === 'Escape') setCustom(null)
          }}
          placeholder="type the word…"
          className="cm-input h-8 min-w-0 flex-1 text-xs"
        />
        <button
          type="button"
          disabled={!custom.trim() || busy}
          onClick={() => onResolve(custom.trim())}
          className="cm-btn cm-btn-primary h-8 px-2.5 text-xs"
        >
          ✓
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className="rounded bg-white px-1.5 py-0.5 font-mono text-xs font-semibold text-neutral-800"
        title={issue.note}
      >
        {issue.text}
      </span>
      <span className="text-xs text-neutral-400">→</span>
      {issue.options
        .filter((o) => o !== issue.text)
        .map((option) => (
          <button
            key={option}
            type="button"
            disabled={busy}
            onClick={() => onResolve(option)}
            className="rounded-lg border border-sky-200 bg-white px-2.5 py-1 text-xs font-medium text-sky-700 transition hover:bg-sky-100 active:scale-95"
          >
            {option}
          </button>
        ))}
      <button
        type="button"
        disabled={busy}
        onClick={() => setCustom('')}
        title="Type it yourself"
        className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-500 transition hover:bg-neutral-100"
      >
        ✏️
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => onResolve(issue.text)}
        title="It's right as written"
        className="rounded-lg px-2 py-1 text-xs text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600"
      >
        keep
      </button>
    </div>
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
