'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createPortal } from 'react-dom'
import type { RecentScript } from '@/lib/supabase/context'
import { cleanReadingText } from '@/lib/client/script-text'

interface RecentScriptsProps {
  scripts: RecentScript[]
  clinicId: string
  // Starring is an admin act — it is what puts a script on the doctor's
  // list. For her the star is a read-only marker.
  canStar?: boolean
}

export function RecentScripts({
  scripts: initialScripts,
  clinicId,
  canStar = true,
}: RecentScriptsProps) {
  const [scripts, setScripts] = useState(initialScripts)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  const open = openId ? (scripts.find((s) => s.id === openId) ?? null) : null

  async function onCopy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch { /* noop */ }
  }

  async function onDelete(id: string) {
    // Optimistic remove
    setScripts((prev) => prev.filter((s) => s.id !== id))
    if (openId === id) setOpenId(null)
    try {
      const res = await fetch(`/api/scripts/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        // Rollback on failure
        setScripts(initialScripts)
        console.error('Delete failed:', await res.text())
      }
    } catch {
      setScripts(initialScripts)
    }
  }

  async function onToggleStar(id: string) {
    const current = scripts.find((s) => s.id === id)
    if (!current) return
    const next = !current.starred
    patchLocal(id, { starred: next })
    try {
      const res = await fetch(`/api/scripts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starred: next }),
      })
      if (!res.ok) patchLocal(id, { starred: !next })
    } catch {
      patchLocal(id, { starred: !next })
    }
  }

  function patchLocal(id: string, patch: Partial<RecentScript>) {
    setScripts((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  async function onSaveEdit(
    id: string,
    fields: { topic: string; hook: string; full_script: string }
  ): Promise<string | null> {
    try {
      const res = await fetch(`/api/scripts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      const body = (await res.json().catch(() => ({}))) as {
        error?: string
        script?: Partial<RecentScript>
      }
      if (!res.ok) return body.error ?? `Save failed (${res.status})`
      patchLocal(id, {
        topic: fields.topic,
        hook: fields.hook || null,
        full_script: fields.full_script,
        word_count: body.script?.word_count ?? null,
        updated_at: body.script?.updated_at ?? new Date().toISOString(),
      })
      return null
    } catch (e) {
      return e instanceof Error ? e.message : 'Save failed'
    }
  }

  if (scripts.length === 0) {
    return (
      <div className="cm-card p-6 text-center">
        <p className="text-sm text-neutral-600">
          {canStar
            ? 'No scripts yet. Generate your first batch above.'
            : 'Nothing to record yet — your marketing team stars the scripts they want you to film.'}
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {scripts.map((s) => (
          <ScriptCard
            key={s.id}
            script={s}
            clinicId={clinicId}
            copiedId={copiedId}
            onOpen={() => setOpenId(s.id)}
            onCopy={() => onCopy(s.id, s.full_script)}
            onDelete={() => onDelete(s.id)}
            onToggleStar={() => onToggleStar(s.id)}
            canStar={canStar}
          />
        ))}
      </div>

      {open && (
        <ScriptModal
          script={open}
          clinicId={clinicId}
          copied={copiedId === open.id}
          onCopy={() => onCopy(open.id, open.full_script)}
          onDelete={() => onDelete(open.id)}
          onToggleStar={() => onToggleStar(open.id)}
          canStar={canStar}
          onSave={(fields) => onSaveEdit(open.id, fields)}
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  )
}

// ── Star ─────────────────────────────────────────────────────────────────────

function StarButton({
  starred,
  onToggle,
  size = 16,
  interactive = true,
}: {
  starred: boolean
  onToggle: () => void
  size?: number
  interactive?: boolean
}) {
  // Read-only: the doctor sees WHY this script is on her list, but the
  // star stays the marketing team's switch.
  if (!interactive) {
    if (!starred) return null
    return (
      <span
        className="-m-1 p-2.5 text-amber-400"
        title="Picked for you by your marketing team"
        aria-label="Picked for you by your marketing team"
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinejoin="round"
        >
          <path d="M12 3.5l2.6 5.28 5.83.85-4.22 4.11.996 5.81L12 16.82l-5.21 2.74.996-5.81L3.57 9.63l5.83-.85L12 3.5z" />
        </svg>
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      aria-pressed={starred}
      aria-label={starred ? 'Remove from favourites' : 'Mark as favourite'}
      title={starred ? 'Remove from favourites' : 'Mark as favourite'}
      // -m-1 keeps the visual size tight while the padding gives thumbs
      // a ~40px target on phones
      className={`-m-1 rounded-lg p-2.5 transition touch-manipulation ${
        starred
          ? 'text-amber-400 hover:text-amber-500'
          : 'text-neutral-300 hover:bg-amber-50 hover:text-amber-400'
      }`}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={starred ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinejoin="round"
      >
        <path d="M12 3.5l2.6 5.28 5.83.85-4.22 4.11.996 5.81L12 16.82l-5.21 2.74.996-5.81L3.57 9.63l5.83-.85L12 3.5z" />
      </svg>
    </button>
  )
}

// ── Card ─────────────────────────────────────────────────────────────────────

function ScriptCard({
  script: s,
  clinicId,
  copiedId,
  onOpen,
  onCopy,
  onDelete,
  onToggleStar,
  canStar,
}: {
  script: RecentScript
  clinicId: string
  copiedId: string | null
  onOpen: () => void
  onCopy: () => void
  onDelete: () => void
  onToggleStar: () => void
  canStar: boolean
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const score = typeof s.critic_score === 'number' ? s.critic_score : null
  const strong = score !== null && score >= 7
  const preview = (s.hook ?? s.full_script ?? '').replace(/\s+/g, ' ').trim()

  return (
    <article
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() }
      }}
      className={`group flex h-full cursor-pointer flex-col gap-3 rounded-2xl border bg-white p-5 shadow-[0_1px_3px_rgba(10,10,10,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-[0_4px_16px_rgba(10,10,10,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
        s.starred ? 'border-amber-200' : 'border-neutral-200'
      }`}
    >
      <header className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-neutral-900">
          {s.topic ?? 'Untitled'}
        </h3>
        <div className="flex shrink-0 items-center gap-1.5">
          {score !== null && (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${
                strong ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {score.toFixed(1)}
            </span>
          )}
          {s.approved && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Compliant
            </span>
          )}
          <StarButton starred={s.starred} onToggle={onToggleStar} interactive={canStar} />
        </div>
      </header>

      {preview && (
        <p className="line-clamp-3 flex-1 text-[13px] leading-relaxed text-neutral-500">
          {preview}
        </p>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2 pt-1">
        <div className="flex items-center gap-2 min-w-0">
          {s.template_used && (
            <span
              className="truncate text-[11px] text-violet-600"
              title={`Template: ${s.template_used}`}
            >
              {s.template_used}
            </span>
          )}
          <span className="shrink-0 text-[11px] text-neutral-400">
            {formatDate(s.created_at)} · {s.word_count ?? '?'}w
          </span>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {confirmDelete ? (
            <>
              <button
                type="button"
                onClick={() => { onDelete(); setConfirmDelete(false) }}
                className="rounded-lg bg-red-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-red-600"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg px-2 py-1 text-[11px] text-neutral-400 hover:text-neutral-700"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              {/* Straight into reading this exact script to camera */}
              <Link
                href={`/teleprompter?clinicId=${clinicId}&scriptId=${s.id}`}
                className="cm-btn cm-btn-ghost py-1 text-xs"
                title="Read this script in the teleprompter"
              >
                Teleprompter →
              </Link>
              <button
                type="button"
                onClick={onCopy}
                className="cm-btn cm-btn-ghost py-1 text-xs"
              >
                {copiedId === s.id ? 'Copied' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="rounded-lg p-1 text-neutral-300 transition hover:bg-red-50 hover:text-red-500"
                title="Delete script"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M2 4h12M5 4V2.5A.5.5 0 015.5 2h5a.5.5 0 01.5.5V4M6 7v5M10 7v5M3 4l.9 9.1A1 1 0 004.9 14h6.2a1 1 0 001-.9L13 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </>
          )}
        </div>
      </footer>
    </article>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function ScriptModal({
  script,
  clinicId,
  copied,
  onCopy,
  onDelete,
  onToggleStar,
  canStar,
  onSave,
  onClose,
}: {
  script: RecentScript
  clinicId: string
  copied: boolean
  onCopy: () => void
  onDelete: () => void
  onToggleStar: () => void
  canStar: boolean
  onSave: (fields: { topic: string; hook: string; full_script: string }) => Promise<string | null>
  onClose: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [draftTopic, setDraftTopic] = useState(script.topic ?? '')
  const [draftHook, setDraftHook] = useState(script.hook ?? '')
  const [draftBody, setDraftBody] = useState(script.full_script)
  const score = typeof script.critic_score === 'number' ? script.critic_score : null
  const strong = score !== null && score >= 7

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKey(e: KeyboardEvent) {
      // Escape closes the reader, but must not silently discard an edit
      if (e.key === 'Escape' && !editing) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose, editing])

  function startEdit() {
    setDraftTopic(script.topic ?? '')
    setDraftHook(script.hook ?? '')
    setDraftBody(script.full_script)
    setSaveError(null)
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setSaveError(null)
  }

  async function save() {
    if (!draftTopic.trim() || !draftBody.trim()) {
      setSaveError('Title and script text cannot be empty')
      return
    }
    setSaving(true)
    const err = await onSave({
      topic: draftTopic.trim(),
      hook: draftHook.trim(),
      full_script: draftBody.trim(),
    })
    setSaving(false)
    if (err) setSaveError(err)
    else setEditing(false)
  }

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4 cm-backdrop-in"
      style={{ backgroundColor: 'rgba(10,10,10,0.55)', backdropFilter: 'blur(2px)' }}
      onClick={() => { if (!editing) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="
          cm-sheet-in
          flex w-full flex-col overflow-hidden
          rounded-t-3xl sm:rounded-2xl
          bg-white shadow-2xl
          max-h-[92svh] sm:max-h-[85svh] sm:max-w-2xl
        "
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-neutral-200" />
        </div>

        {/* Header */}
        <header className="flex items-start gap-4 border-b border-neutral-100 px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {score !== null && (
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${strong ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {score.toFixed(1)}
                </span>
              )}
              {script.approved && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Compliant
                </span>
              )}
              {script.template_used && (
                <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                  {script.template_used}
                </span>
              )}
              <span className="text-[11px] text-neutral-400">
                {formatDate(script.created_at)} · {script.word_count ?? '?'} words
                {script.updated_at ? ' · edited' : ''}
              </span>
            </div>
            {editing ? (
              <input
                value={draftTopic}
                onChange={(e) => setDraftTopic(e.target.value)}
                placeholder="Title"
                className="mt-2 w-full rounded-xl border border-neutral-200 px-3 py-2 text-lg font-semibold leading-snug text-neutral-900 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
              />
            ) : (
              <h2 className="mt-2 text-xl font-semibold leading-snug text-neutral-900">
                {script.topic ?? 'Untitled'}
              </h2>
            )}
          </div>
          <div className="mt-0.5 flex shrink-0 items-center gap-1">
            <StarButton starred={script.starred} onToggle={onToggleStar} size={18} interactive={canStar} />
            {!editing && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-full p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-800"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        </header>

        {/* Scrollable body */}
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6"
        >
          {editing ? (
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-widest text-sky-400">Hook</span>
                <textarea
                  value={draftHook}
                  onChange={(e) => setDraftHook(e.target.value)}
                  rows={2}
                  placeholder="Opening line (optional)"
                  // 16px on mobile — anything smaller makes iOS zoom the page on focus
                  className="w-full resize-y rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-base italic leading-relaxed text-sky-900 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100 sm:text-sm"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">
                  Script — raw text
                </span>
                <textarea
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                  rows={12}
                  className="min-h-[240px] w-full resize-y rounded-xl border border-neutral-200 px-4 py-3 text-base leading-[1.75] text-neutral-800 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100 sm:min-h-[320px] sm:text-[15px]"
                />
                <span className="text-[11px] leading-relaxed text-neutral-400">
                  This is the stored text, slide markers included. The
                  teleprompter and carousel splitter both read it — keep any
                  &ldquo;Slide N —&rdquo; lines if you still want carousels from this script.
                </span>
              </label>
              {saveError && (
                <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{saveError}</p>
              )}
            </div>
          ) : (
            <>
              {script.hook && (
                <p className="mb-5 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm italic leading-relaxed text-sky-900">
                  <span className="mr-1.5 text-[10px] font-bold not-italic uppercase tracking-widest text-sky-400">Hook</span>
                  {script.hook}
                </p>
              )}
              <p className="whitespace-pre-wrap break-words text-[15px] leading-[1.75] text-neutral-800">
                {cleanReadingText(script.full_script)}
              </p>
            </>
          )}
        </div>

        {/* Footer — extra bottom padding clears the iPhone home indicator */}
        <footer
          className="flex items-center justify-between gap-2 border-t border-neutral-100 px-5 py-3 sm:px-6"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
        >
          {editing ? (
            <>
              <span className="text-xs text-neutral-400">Editing</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={saving}
                  className="cm-btn cm-btn-ghost text-sm disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="cm-btn cm-btn-primary text-sm disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                {confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-500">Delete permanently?</span>
                    <button
                      type="button"
                      onClick={onDelete}
                      className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600"
                    >
                      Yes, delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="text-xs text-neutral-400 hover:text-neutral-700"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-neutral-400 transition hover:bg-red-50 hover:text-red-500"
                  >
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                      <path d="M2 4h12M5 4V2.5A.5.5 0 015.5 2h5a.5.5 0 01.5.5V4M6 7v5M10 7v5M3 4l.9 9.1A1 1 0 004.9 14h6.2a1 1 0 001-.9L13 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Delete
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={startEdit} className="cm-btn cm-btn-ghost text-sm">
                  Edit
                </button>
                <Link
                  href={`/teleprompter?clinicId=${clinicId}&scriptId=${script.id}`}
                  className="cm-btn cm-btn-ghost text-sm"
                >
                  Teleprompter →
                </Link>
                <button type="button" onClick={onCopy} className="cm-btn cm-btn-primary text-sm">
                  {copied ? 'Copied ✓' : 'Copy script'}
                </button>
              </div>
            </>
          )}
        </footer>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null
}

// ─────────────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
