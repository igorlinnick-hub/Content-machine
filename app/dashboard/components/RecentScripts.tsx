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
    <ul className="cm-card divide-y divide-neutral-200 overflow-hidden">
      {scripts.map((s) => {
        const score = typeof s.critic_score === 'number' ? s.critic_score : null
        const strong = score !== null && score >= 7
        return (
          <li
            key={s.id}
            className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-5"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-neutral-900">
                  {s.topic ?? 'Untitled'}
                </p>
                {score !== null && (
                  <span
                    className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                      strong
                        ? 'bg-green-100 text-green-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {score.toFixed(1)}
                  </span>
                )}
                {s.approved && (
                  <span className="inline-flex items-center rounded-md bg-orange-50 px-1.5 py-0.5 text-[11px] font-medium text-orange-700">
                    approved
                  </span>
                )}
              </div>
              {s.hook && (
                <p className="mt-1 truncate text-sm italic text-neutral-600">
                  {s.hook}
                </p>
              )}
              <p className="mt-1 text-xs text-neutral-500">
                {formatDate(s.created_at)} · {s.word_count ?? '?'} words
              </p>
            </div>
            <button
              type="button"
              onClick={() => onCopy(s.id, s.full_script)}
              className="cm-btn cm-btn-ghost shrink-0 text-xs"
            >
              {copiedId === s.id ? 'Copied' : 'Copy'}
            </button>
          </li>
        )
      })}
    </ul>
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
