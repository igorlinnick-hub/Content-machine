'use client'

import { useState } from 'react'
import type { RecentScript } from '@/lib/supabase/context'

interface RecentScriptsProps {
  scripts: RecentScript[]
}

export function RecentScripts({ scripts }: RecentScriptsProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)

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

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {scripts.map((s) => {
        const score = typeof s.critic_score === 'number' ? s.critic_score : null
        const strong = score !== null && score >= 7
        const preview = (s.hook ?? s.full_script ?? '').replace(/\s+/g, ' ').trim()
        return (
          <article
            key={s.id}
            className="group flex h-full flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(10,10,10,0.04)] transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"
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
                onClick={() => onCopy(s.id, s.full_script)}
                className="cm-btn cm-btn-ghost shrink-0 text-xs"
              >
                {copiedId === s.id ? 'Copied' : 'Copy'}
              </button>
            </footer>
          </article>
        )
      })}
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
