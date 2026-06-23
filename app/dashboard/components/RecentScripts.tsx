'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { RecentScript } from '@/lib/supabase/context'

interface RecentScriptsProps {
  scripts: RecentScript[]
}

export function RecentScripts({ scripts: initialScripts }: RecentScriptsProps) {
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

  if (scripts.length === 0) {
    return (
      <div className="cm-card p-6 text-center">
        <p className="text-sm text-neutral-600">
          No scripts yet. Generate your first batch above.
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
            copiedId={copiedId}
            onOpen={() => setOpenId(s.id)}
            onCopy={() => onCopy(s.id, s.full_script)}
            onDelete={() => onDelete(s.id)}
          />
        ))}
      </div>

      {open && (
        <ScriptModal
          script={open}
          copied={copiedId === open.id}
          onCopy={() => onCopy(open.id, open.full_script)}
          onDelete={() => onDelete(open.id)}
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  )
}

// ── Card ─────────────────────────────────────────────────────────────────────

function ScriptCard({
  script: s,
  copiedId,
  onOpen,
  onCopy,
  onDelete,
}: {
  script: RecentScript
  copiedId: string | null
  onOpen: () => void
  onCopy: () => void
  onDelete: () => void
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
      className="group flex h-full cursor-pointer flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-[0_1px_3px_rgba(10,10,10,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-[0_4px_16px_rgba(10,10,10,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
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
        </div>
      </header>

      {preview && (
        <p className="line-clamp-3 flex-1 text-[13px] leading-relaxed text-neutral-500">
          {preview}
        </p>
      )}

      <footer className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2 min-w-0">
          {s.template_used && (
            <span
              className="truncate text-[11px] text-violet-600"
              title={`Template: ${s.template_used}`}
            >
              🧱 {s.template_used}
            </span>
          )}
          <span className="shrink-0 text-[11px] text-neutral-400">
            {formatDate(s.created_at)} · {s.word_count ?? '?'}w
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
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
  copied,
  onCopy,
  onDelete,
  onClose,
}: {
  script: RecentScript
  copied: boolean
  onCopy: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const score = typeof script.critic_score === 'number' ? script.critic_score : null
  const strong = score !== null && score >= 7

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4 cm-backdrop-in"
      style={{ backgroundColor: 'rgba(10,10,10,0.55)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
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
                  🧱 {script.template_used}
                </span>
              )}
              <span className="text-[11px] text-neutral-400">
                {formatDate(script.created_at)} · {script.word_count ?? '?'} words
              </span>
            </div>
            <h2 className="mt-2 text-xl font-semibold leading-snug text-neutral-900">
              {script.topic ?? 'Untitled'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="mt-0.5 shrink-0 rounded-full p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-800"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        {/* Scrollable body */}
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6"
        >
          {script.hook && (
            <p className="mb-5 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm italic leading-relaxed text-sky-900">
              <span className="mr-1.5 text-[10px] font-bold not-italic uppercase tracking-widest text-sky-400">Hook</span>
              {script.hook}
            </p>
          )}
          <p className="whitespace-pre-wrap break-words text-[15px] leading-[1.75] text-neutral-800">
            {script.full_script}
          </p>
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between gap-2 border-t border-neutral-100 px-5 py-3 sm:px-6">
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
            <button type="button" onClick={onClose} className="cm-btn cm-btn-ghost text-sm">
              Close
            </button>
            <button type="button" onClick={onCopy} className="cm-btn cm-btn-primary text-sm">
              {copied ? 'Copied ✓' : 'Copy script'}
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
