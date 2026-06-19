'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { RecentScript } from '@/lib/supabase/context'

interface RecentScriptsProps {
  scripts: RecentScript[]
}

export function RecentScripts({ scripts }: RecentScriptsProps) {
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
          />
        ))}
      </div>

      {open && (
        <ScriptModal
          script={open}
          copied={copiedId === open.id}
          onCopy={() => onCopy(open.id, open.full_script)}
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
}: {
  script: RecentScript
  copiedId: string | null
  onOpen: () => void
  onCopy: () => void
}) {
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
            <span className="text-sky-500" title="Approved">✓</span>
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
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onCopy() }}
          className="cm-btn cm-btn-ghost shrink-0 py-1 text-xs"
        >
          {copiedId === s.id ? 'Copied' : 'Copy'}
        </button>
      </footer>
    </article>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function ScriptModal({
  script,
  copied,
  onCopy,
  onClose,
}: {
  script: RecentScript
  copied: boolean
  onCopy: () => void
  onClose: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const score = typeof script.critic_score === 'number' ? script.critic_score : null
  const strong = score !== null && score >= 7

  // Lock body scroll; prevent scroll chaining in the modal
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
      {/* Dialog */}
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
                <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                  approved
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

        {/* Scrollable body — overscroll-contain prevents chaining to page */}
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
        <footer className="flex items-center justify-end gap-2 border-t border-neutral-100 px-5 py-3 sm:px-6">
          <button type="button" onClick={onClose} className="cm-btn cm-btn-ghost text-sm">
            Close
          </button>
          <button type="button" onClick={onCopy} className="cm-btn cm-btn-primary text-sm">
            {copied ? 'Copied ✓' : 'Copy script'}
          </button>
        </footer>
      </div>
    </div>
  )

  // Render into document.body to avoid z-index / scroll stacking context issues
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
