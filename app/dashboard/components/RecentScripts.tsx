'use client'

import { useEffect, useState } from 'react'
import type { RecentScript } from '@/lib/supabase/context'

interface RecentScriptsProps {
  scripts: RecentScript[]
}

export function RecentScripts({ scripts }: RecentScriptsProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    if (!openId) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenId(null)
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [openId])

  if (scripts.length === 0) {
    return (
      <div className="cm-card p-6 text-center">
        <p className="text-sm text-neutral-600">
          No scripts yet. Generate your first batch above.
        </p>
      </div>
    )
  }

  async function onCopy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {
      // noop — user can still select text
    }
  }

  const open = openId ? scripts.find((s) => s.id === openId) ?? null : null

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {scripts.map((s) => {
          const score = typeof s.critic_score === 'number' ? s.critic_score : null
          const strong = score !== null && score >= 7
          const preview = (s.hook ?? s.full_script ?? '').replace(/\s+/g, ' ').trim()
          return (
            <article
              key={s.id}
              onClick={() => setOpenId(s.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setOpenId(s.id)
                }
              }}
              className="group flex h-full cursor-pointer flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(10,10,10,0.04)] transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              <header className="flex items-start justify-between gap-2">
                <h3 className="line-clamp-2 text-base font-semibold leading-snug text-neutral-900">
                  {s.topic ?? 'Untitled'}
                </h3>
                <div className="flex shrink-0 items-center gap-1">
                  {score !== null && (
                    <span
                      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                        strong
                          ? 'bg-green-100 text-green-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                      title={`Critic score ${score.toFixed(1)}`}
                    >
                      {score.toFixed(1)}
                    </span>
                  )}
                  {s.approved && (
                    <span
                      className="inline-flex items-center rounded-md bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-700"
                      title="Approved by you"
                    >
                      ✓
                    </span>
                  )}
                </div>
              </header>

              {preview && (
                <p className="line-clamp-3 flex-1 text-sm leading-relaxed text-neutral-600">
                  {preview}
                </p>
              )}

              <footer className="flex items-center justify-between gap-2 pt-1">
                <p className="text-xs text-neutral-500">
                  {formatDate(s.created_at)} · {s.word_count ?? '?'} words
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onCopy(s.id, s.full_script)
                  }}
                  className="cm-btn cm-btn-ghost shrink-0 text-xs"
                >
                  {copiedId === s.id ? 'Copied' : 'Copy'}
                </button>
              </footer>
            </article>
          )
        })}
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
  const score =
    typeof script.critic_score === 'number' ? script.critic_score : null
  const strong = score !== null && score >= 7

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 p-4 cm-fade-in"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-start justify-between gap-4 border-b border-neutral-200 px-6 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {score !== null && (
                <span
                  className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                    strong
                      ? 'bg-green-100 text-green-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {score.toFixed(1)}
                </span>
              )}
              {script.approved && (
                <span className="inline-flex items-center rounded-md bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-700">
                  approved
                </span>
              )}
              <span className="text-xs text-neutral-500">
                {formatDate(script.created_at)} · {script.word_count ?? '?'} words
              </span>
            </div>
            <h2 className="mt-1.5 text-xl font-semibold leading-snug text-neutral-900">
              {script.topic ?? 'Untitled'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-full p-1 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M5 5l10 10M15 5l-10 10"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {script.hook && (
            <p className="mb-4 text-sm italic text-neutral-600">
              {script.hook}
            </p>
          )}
          <pre className="whitespace-pre-wrap break-words font-sans text-[15px] leading-relaxed text-neutral-800">
            {script.full_script}
          </pre>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-neutral-200 bg-neutral-50 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="cm-btn cm-btn-ghost text-sm"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onCopy}
            className="cm-btn cm-btn-primary text-sm"
          >
            {copied ? 'Copied ✓' : 'Copy script'}
          </button>
        </footer>
      </div>
    </div>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
