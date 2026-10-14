'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import type { RecentScript } from '@/lib/supabase/context'
import { cleanReadingText } from '@/lib/client/script-text'
import {
  MANUAL_SCRIPT_MAX_CHARS,
  MANUAL_SOURCE,
  gateRan,
  starBlockReason,
  wordCount,
} from '@/lib/scripts/manual'

type ComplianceAction = 'check' | 'fix'

interface RecentScriptsProps {
  scripts: RecentScript[]
  clinicId: string
  // Starring is an admin act — it is what puts a script on the doctor's
  // list. For her the star is a read-only marker.
  canStar?: boolean
  // "+ Add your own script" — admin only, like Generate.
  canAdd?: boolean
}

export function RecentScripts({
  scripts: initialScripts,
  clinicId,
  canStar = true,
  canAdd = false,
}: RecentScriptsProps) {
  const router = useRouter()
  const [scripts, setScripts] = useState(initialScripts)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

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

  // Returns why the star did not change, or null. The server refuses a
  // star on flagged or unchecked wording (409) — the button is locked for
  // those already, this covers a verdict that changed under the page.
  async function onToggleStar(id: string): Promise<string | null> {
    const current = scripts.find((s) => s.id === id)
    if (!current) return null
    const next = !current.starred
    if (next) {
      const blocked = starBlockReason(current)
      if (blocked) return blocked
    }
    patchLocal(id, { starred: next })
    try {
      const res = await fetch(`/api/scripts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starred: next }),
      })
      if (res.ok) return null
      patchLocal(id, { starred: !next })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      return body.error ?? `Could not update the star (${res.status})`
    } catch (e) {
      patchLocal(id, { starred: !next })
      return e instanceof Error ? e.message : 'Could not update the star'
    }
  }

  function onCreated(script: RecentScript) {
    setScripts((prev) => [script, ...prev])
    setAdding(false)
    // Straight into the saved script: the verdict panel is where the
    // next step (star / fix / edit) lives.
    setOpenId(script.id)
    router.refresh()
  }

  async function onCompliance(
    id: string,
    action: ComplianceAction
  ): Promise<{ error?: string; changed?: boolean }> {
    try {
      const res = await fetch(`/api/scripts/${id}/compliance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        error?: string
        changed?: boolean
        script?: Partial<RecentScript>
      }
      if (!res.ok || !body.script) return { error: body.error ?? `Check failed (${res.status})` }
      patchLocal(id, body.script)
      if (body.changed) router.refresh()
      return { changed: body.changed }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Check failed' }
    }
  }

  function patchLocal(id: string, patch: Partial<RecentScript>) {
    setScripts((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  async function onSaveEdit(
    id: string,
    fields: { topic: string; hook?: string; full_script: string }
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
        // The server derives a hand-written script's hook from its first line.
        hook: body.script?.hook ?? (fields.hook || null),
        full_script: fields.full_script,
        word_count: body.script?.word_count ?? null,
        updated_at: body.script?.updated_at ?? new Date().toISOString(),
        // A text edit re-grades rows that carry a verdict.
        ...(body.script && 'compliance' in body.script
          ? { compliance: body.script.compliance ?? null }
          : {}),
      })
      // Local state only fixes THIS list. The teleprompter is a separate
      // server-rendered route — without a refresh it reads the text this
      // page was built with and the doctor records the pre-edit version.
      router.refresh()
      return null
    } catch (e) {
      return e instanceof Error ? e.message : 'Save failed'
    }
  }

  const addModal = adding && (
    <AddScriptModal
      clinicId={clinicId}
      onCreated={onCreated}
      onClose={() => setAdding(false)}
    />
  )

  if (scripts.length === 0) {
    return (
      <>
        <div className="cm-card flex flex-col items-center gap-4 p-6 text-center">
          <p className="text-sm text-neutral-600">
            {canAdd
              ? 'No scripts yet. Generate a batch, or add one you wrote yourself.'
              : canStar
                ? 'No scripts yet. Generate your first batch above.'
                : 'Nothing to record yet — your marketing team stars the scripts they want you to film.'}
          </p>
          {canAdd && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="cm-btn cm-btn-primary text-sm"
            >
              + Add your own script
            </button>
          )}
        </div>
        {addModal}
      </>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {canAdd && <AddScriptTile onClick={() => setAdding(true)} />}
        {scripts.map((s) => (
          <ScriptCard
            key={s.id}
            script={s}
            clinicId={clinicId}
            copiedId={copiedId}
            onOpen={() => setOpenId(s.id)}
            onCopy={() => onCopy(s.id, s.full_script)}
            onDelete={() => onDelete(s.id)}
            onToggleStar={() => { void onToggleStar(s.id) }}
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
          onCompliance={(action) => onCompliance(open.id, action)}
          onClose={() => setOpenId(null)}
        />
      )}

      {addModal}
    </>
  )
}

// ── Star ─────────────────────────────────────────────────────────────────────

function StarButton({
  starred,
  onToggle,
  size = 16,
  interactive = true,
  blockedReason = null,
}: {
  starred: boolean
  onToggle: () => void
  size?: number
  interactive?: boolean
  // Set while the wording is flagged or unchecked: the star cannot be
  // turned ON. An already-starred script can always be unstarred.
  blockedReason?: string | null
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

  if (blockedReason && !starred) {
    return (
      <span
        onClick={(e) => e.stopPropagation()}
        className="-m-1 cursor-not-allowed p-2.5 text-neutral-200"
        title={blockedReason}
        aria-label={`Can't star yet: ${blockedReason}`}
        role="img"
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
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
  const manual = s.source === MANUAL_SOURCE
  // The body, not the stored hook. The teleprompter edits full_script, so a
  // card that previews `hook` kept showing the pre-edit opening and the
  // script read as unchanged (Igor 2026-09-25). Cleaned the same way the
  // teleprompter reads it, so the card shows what the doctor will say —
  // the hook stays the fallback for rows whose body has not loaded.
  const preview = (
    cleanReadingText(s.full_script ?? '') || s.hook || ''
  )
    .replace(/\s+/g, ' ')
    .trim()

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
          {canStar && <VerdictChip script={s} />}
          <StarButton
            starred={s.starred}
            onToggle={onToggleStar}
            interactive={canStar}
            blockedReason={canStar ? starBlockReason(s) : null}
          />
        </div>
      </header>

      {preview && (
        <p className="line-clamp-3 flex-1 text-[13px] leading-relaxed text-neutral-500">
          {preview}
        </p>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2 pt-1">
        <div className="flex items-center gap-2 min-w-0">
          {manual && (
            <span className="truncate text-[11px] text-violet-600" title="Added by hand, not by Writer">
              Hand-written
            </span>
          )}
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
  onCompliance,
  onClose,
}: {
  script: RecentScript
  clinicId: string
  copied: boolean
  onCopy: () => void
  onDelete: () => void
  onToggleStar: () => Promise<string | null>
  canStar: boolean
  onSave: (fields: { topic: string; hook?: string; full_script: string }) => Promise<string | null>
  onCompliance: (action: ComplianceAction) => Promise<{ error?: string; changed?: boolean }>
  onClose: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [starError, setStarError] = useState<string | null>(null)
  // Rows that carry a verdict are re-graded on save — the button says so,
  // because that save takes seconds, not milliseconds.
  const manual = script.source === MANUAL_SOURCE
  const tracksCompliance = manual || script.compliance !== null
  const showVerdict = canStar && tracksCompliance

  async function toggleStar() {
    setStarError(await onToggleStar())
  }
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
      // Hand-written: the hook is the first line, the server keeps it in step.
      hook: manual ? undefined : draftHook.trim(),
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
            <StarButton
              starred={script.starred}
              onToggle={toggleStar}
              size={18}
              interactive={canStar}
              blockedReason={canStar ? starBlockReason(script) : null}
            />
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
              {/* A hand-written script's hook is its first line — the server
                  keeps it in step, so there is no separate field to go stale. */}
              {!manual && (
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
              )}
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
              {starError && (
                <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{starError}</p>
              )}
              {showVerdict && (
                <CompliancePanel
                  key={script.id}
                  script={script}
                  onCompliance={onCompliance}
                  onEdit={startEdit}
                />
              )}
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
                  {saving
                    ? tracksCompliance ? 'Saving & checking…' : 'Saving…'
                    : 'Save changes'}
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

// ── Compliance verdict ───────────────────────────────────────────────────────
// Shown on rows that carry a verdict (hand-added, Studio). Never says
// "safe" or "compliant": the gate is a screen, sign-off is the medical
// director's (COMPLIANCE-INTEGRATION.md).

type VerdictTone = 'ok' | 'info' | 'warn' | 'stop' | 'none'

interface VerdictLook {
  tone: VerdictTone
  chip: string | null
  title: string
  body: string
}

const TONE: Record<VerdictTone, { chip: string; panel: string; dot: string }> = {
  ok: { chip: '', panel: 'border-emerald-100 bg-emerald-50/70', dot: 'bg-emerald-500' },
  info: { chip: 'bg-sky-100 text-sky-800', panel: 'border-sky-100 bg-sky-50/70', dot: 'bg-sky-500' },
  warn: { chip: 'bg-amber-100 text-amber-800', panel: 'border-amber-200 bg-amber-50/70', dot: 'bg-amber-500' },
  stop: { chip: 'bg-red-100 text-red-700', panel: 'border-red-200 bg-red-50/70', dot: 'bg-red-500' },
  none: { chip: 'bg-neutral-100 text-neutral-600', panel: 'border-neutral-200 bg-neutral-50', dot: 'bg-neutral-400' },
}

function verdictLook(script: RecentScript): VerdictLook | null {
  const c = script.compliance
  if (!c || !gateRan(c)) {
    if (script.source !== MANUAL_SOURCE && !c) return null
    return {
      tone: 'none',
      chip: 'Not checked',
      title: 'Not checked yet',
      body: "The last compliance check didn't run, so this script can't be starred yet.",
    }
  }
  switch (c.grade) {
    case 'PASS':
      return {
        tone: 'ok',
        chip: null,
        title: 'Nothing flagged',
        body: 'The compliance screen found no wording to change. Final sign-off still sits with the medical director.',
      }
    case 'REVIEW':
      return {
        tone: 'info',
        chip: 'Review',
        title: 'Needs a human look',
        body: "Nothing here locks the star, but these lines make claims the screen can't verify — the medical director should check them.",
      }
    case 'REWORD':
      return {
        tone: 'warn',
        chip: 'Reword',
        title: 'Reword before it goes to the doctor',
        body: 'Starring is locked until these lines are reworded. Fix them by hand, or let the rewriter do it.',
      }
    case 'REMOVE':
      return {
        tone: 'stop',
        chip: 'Blocked',
        title: "Can't go out as written",
        body: "The claim itself isn't allowed, so rewording won't save it. Rewrite these lines by hand.",
      }
  }
}

function VerdictChip({ script }: { script: RecentScript }) {
  const look = verdictLook(script)
  if (!look?.chip) return null
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE[look.tone].chip}`}
      title={look.title}
    >
      {look.chip}
    </span>
  )
}

function CompliancePanel({
  script,
  onCompliance,
  onEdit,
}: {
  script: RecentScript
  onCompliance: (action: ComplianceAction) => Promise<{ error?: string; changed?: boolean }>
  onEdit: () => void
}) {
  const [busy, setBusy] = useState<ComplianceAction | null>(null)
  const [note, setNote] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null)
  const look = verdictLook(script)
  if (!look) return null

  const graded = script.compliance && gateRan(script.compliance) ? script.compliance : null
  const findings = (graded?.findings ?? []).filter((f) => f.matched || f.correction)
  const canFix = graded?.grade === 'REWORD' || graded?.grade === 'REVIEW'
  const needsEdit = graded?.grade === 'REWORD' || graded?.grade === 'REMOVE'

  async function run(action: ComplianceAction) {
    setBusy(action)
    setNote(null)
    const r = await onCompliance(action)
    setBusy(null)
    if (r.error) setNote({ tone: 'warn', text: r.error })
    else if (action === 'fix') {
      setNote(
        r.changed
          ? { tone: 'ok', text: 'Rewrote the flagged lines. Read the new text below before starring.' }
          : { tone: 'warn', text: "The rewriter couldn't improve this one — edit those lines by hand." }
      )
    }
  }

  return (
    <section className={`mb-5 rounded-xl border px-4 py-3.5 ${TONE[look.tone].panel}`} aria-live="polite">
      {/* Wraps on a phone: the timestamp drops under the title instead of
          squeezing it into a one-word column. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <div className="flex items-center gap-2">
          <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${TONE[look.tone].dot}`} />
          <h3 className="text-sm font-semibold text-neutral-900">{look.title}</h3>
        </div>
        {graded && (
          <span className="text-[11px] text-neutral-400">
            Checked {formatDate(graded.run_at)} · rules {graded.ruleset_version}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-600">{look.body}</p>

      {findings.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {findings.map((f, i) => (
            <li
              key={`${f.rule}-${i}`}
              className={`rounded-lg border-l-2 bg-white/80 px-3 py-2 text-[13px] leading-relaxed ${
                f.severity === 'remove'
                  ? 'border-red-400'
                  : f.severity === 'reword'
                    ? 'border-amber-400'
                    : 'border-sky-400'
              }`}
            >
              <span className="mr-1.5 rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500">
                {f.rule}
              </span>
              {/* The LLM quotes the text; factCheck names the pattern it caught. */}
              {f.matched && (
                <span className="text-neutral-900">
                  {f.source === 'llm' ? <>&ldquo;{f.matched}&rdquo;</> : f.matched}
                </span>
              )}
              {f.correction && <span className="mt-0.5 block text-neutral-600">→ {f.correction}</span>}
            </li>
          ))}
        </ul>
      )}

      {note && (
        <p
          className={`mt-3 rounded-lg px-3 py-2 text-[13px] ${
            note.tone === 'ok' ? 'bg-emerald-100/70 text-emerald-800' : 'bg-amber-100/70 text-amber-800'
          }`}
        >
          {note.text}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canFix && (
          <button
            type="button"
            onClick={() => run('fix')}
            disabled={busy !== null}
            className="cm-btn cm-btn-sky py-1.5 text-xs disabled:opacity-60"
          >
            {busy === 'fix' ? 'Rewriting flagged lines… up to a minute' : 'Fix wording for me'}
          </button>
        )}
        {needsEdit && (
          <button
            type="button"
            onClick={onEdit}
            disabled={busy !== null}
            className="cm-btn cm-btn-ghost py-1.5 text-xs disabled:opacity-60"
          >
            Edit text
          </button>
        )}
        <button
          type="button"
          onClick={() => run('check')}
          disabled={busy !== null}
          className={`cm-btn py-1.5 text-xs disabled:opacity-60 ${graded ? 'cm-btn-ghost' : 'cm-btn-sky'}`}
        >
          {busy === 'check' ? 'Checking…' : graded ? 'Check again' : 'Run the check'}
        </button>
      </div>
    </section>
  )
}

// ── Add your own ─────────────────────────────────────────────────────────────

function AddScriptTile({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-full min-h-[148px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-neutral-200 bg-white/50 p-5 text-center transition-all duration-200 touch-manipulation hover:border-sky-300 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 active:scale-[0.98]"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-50 text-sky-500 transition group-hover:bg-sky-100">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </span>
      <span className="text-[15px] font-semibold text-neutral-900">Add your own script</span>
      <span className="max-w-[16rem] text-[12px] leading-snug text-neutral-500">
        Paste one you wrote. It&rsquo;s screened for compliance when you save.
      </span>
    </button>
  )
}

function AddScriptModal({
  clinicId,
  onCreated,
  onClose,
}: {
  clinicId: string
  onCreated: (script: RecentScript) => void
  onClose: () => void
}) {
  const [topic, setTopic] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const dirty = topic.trim() !== '' || body.trim() !== ''
  const words = wordCount(body)
  const tooLong = body.length > MANUAL_SCRIPT_MAX_CHARS

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) {
      // Escape must not throw away a pasted script
      if (e.key === 'Escape' && !dirty && !saving) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose, dirty, saving])

  async function submit() {
    if (saving) return
    if (!topic.trim()) {
      setError('Give the script a title.')
      titleRef.current?.focus()
      return
    }
    if (!body.trim()) {
      setError('Paste or type the script text.')
      return
    }
    if (tooLong) {
      setError(`That's longer than ${MANUAL_SCRIPT_MAX_CHARS.toLocaleString('en-US')} characters — split it into two scripts.`)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/scripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId, topic: topic.trim(), full_script: body.trim() }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string; script?: RecentScript }
      if (!res.ok || !json.script) {
        setError(json.error ?? `Save failed (${res.status})`)
        setSaving(false)
        return
      }
      onCreated(json.script)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
      setSaving(false)
    }
  }

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4 cm-backdrop-in"
      style={{ backgroundColor: 'rgba(10,10,10,0.55)', backdropFilter: 'blur(2px)' }}
      onClick={() => { if (!dirty && !saving) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-script-title"
        onClick={(e) => e.stopPropagation()}
        className="
          cm-sheet-in
          flex w-full flex-col overflow-hidden
          rounded-t-3xl sm:rounded-2xl
          bg-white shadow-2xl
          max-h-[92svh] sm:max-h-[85svh] sm:max-w-2xl
        "
      >
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-neutral-200" />
        </div>

        <header className="border-b border-neutral-100 px-5 py-4 sm:px-6">
          <h2 id="add-script-title" className="text-xl font-semibold leading-snug text-neutral-900">
            Add your own script
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">
            Saved word for word. It runs through the same compliance screen as generated
            scripts — anything flagged is listed so you can fix it before it goes to the doctor.
          </p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">Title</span>
              <input
                ref={titleRef}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                maxLength={200}
                disabled={saving}
                placeholder="What is this script about?"
                // 16px on mobile — anything smaller makes iOS zoom the page on focus
                className="w-full rounded-xl border border-neutral-200 px-3.5 py-2.5 text-base font-medium text-neutral-900 outline-none placeholder:font-normal placeholder:text-neutral-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-100 disabled:bg-neutral-50 sm:text-[15px]"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">Script</span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    void submit()
                  }
                }}
                disabled={saving}
                rows={12}
                placeholder="Paste the script, or type it the way it will be said on camera."
                className="min-h-[240px] w-full resize-y rounded-xl border border-neutral-200 px-4 py-3 text-base leading-[1.75] text-neutral-800 outline-none placeholder:text-neutral-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-100 disabled:bg-neutral-50 sm:min-h-[320px] sm:text-[15px]"
              />
              <span className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-[11px] leading-relaxed text-neutral-400">
                <span className={tooLong ? 'font-semibold text-red-500' : undefined}>
                  {words} {words === 1 ? 'word' : 'words'}
                  {tooLong ? ' — too long' : ''}
                </span>
                <span>The first line becomes the hook.</span>
              </span>
            </label>
            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>
            )}
          </div>
        </div>

        <footer
          className="flex items-center justify-between gap-2 border-t border-neutral-100 px-5 py-3 sm:px-6"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
        >
          <span className="hidden text-xs text-neutral-400 sm:inline">
            {saving ? 'Checking the wording — about 15 seconds' : '⌘ Enter to save'}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="cm-btn cm-btn-ghost text-sm disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={saving}
              className="cm-btn cm-btn-sky text-sm disabled:opacity-60"
            >
              {saving ? 'Checking…' : 'Save & check'}
            </button>
          </div>
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
