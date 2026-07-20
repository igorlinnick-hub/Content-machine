'use client'

import { useState } from 'react'
import type { StructuredPlanWeek, StructuredPlanPost } from '@/lib/content-plan/store'
import { pillarColor } from '@/lib/content-plan/store'

export function WeekCard({
  week,
  clinicId,
  isCurrent,
}: {
  week: StructuredPlanWeek
  clinicId: string
  isCurrent: boolean
}) {
  const color = pillarColor(week.pillar)
  const [skipping, setSkipping] = useState(false)
  const [hidden, setHidden] = useState(false)

  async function skipWeek() {
    if (skipping) return
    setSkipping(true)
    try {
      await fetch('/api/content-plan/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekId: week.id }),
      })
      setHidden(true)
    } catch {
      setSkipping(false)
    }
  }

  if (hidden) return null

  return (
    <div
      className="flex flex-col gap-4 rounded-2xl border p-5"
      style={{
        background: 'rgba(255,255,255,0.60)',
        backdropFilter: 'blur(20px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
        borderColor: isCurrent ? color : 'rgba(255,255,255,0.72)',
        borderWidth: isCurrent ? 2 : 1,
        boxShadow: isCurrent
          ? `0 4px 24px ${color}20`
          : '0 2px 16px rgba(0,0,0,0.05)',
      }}
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
            Week {week.week_number}
          </span>
          {isCurrent && (
            <span
              className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em]"
              style={{ background: `${color}20`, color }}
            >
              Now
            </span>
          )}
          <span
            className="max-w-[140px] truncate rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em]"
            style={{
              background: `${color}18`,
              color,
              border: `1px solid ${color}30`,
            }}
            title={week.pillar}
          >
            {week.pillar}
          </span>
          <button
            onClick={skipWeek}
            disabled={skipping}
            className="ml-auto shrink-0 rounded-lg px-2 py-1 text-[10px] font-semibold text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600 disabled:opacity-40"
            title="Skip this week — remove from plan rotation"
          >
            {skipping ? '…' : 'Skip week'}
          </button>
        </div>
        <h3 className="text-[15px] font-bold leading-snug tracking-tight text-neutral-900">
          {week.theme}
        </h3>
      </div>

      {week.description && (
        <p className="text-[13px] leading-relaxed text-neutral-600">{week.description}</p>
      )}

      <div className="flex flex-col gap-2">
        {week.posts.map((post: StructuredPlanPost, i: number) => (
          <div
            key={post.id}
            className="flex items-center justify-between gap-3 rounded-xl px-3 py-2"
            style={{ background: `${color}08`, border: `1px solid ${color}18` }}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="shrink-0 text-[11px] font-bold tabular-nums" style={{ color }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="truncate text-[13px] text-neutral-700">{post.topic}</span>
            </div>
            {post.keyword && (
              <span
                className="shrink-0 rounded px-2 py-0.5 font-mono text-[10px] font-semibold"
                style={{ background: `${color}18`, color }}
              >
                {post.keyword}
              </span>
            )}
          </div>
        ))}
      </div>

      {clinicId && (
        <a
          href={`/dashboard?clinicId=${clinicId}&tab=generate`}
          className="mt-1 self-start rounded-lg px-3 py-1.5 text-[12px] font-semibold transition hover:opacity-80"
          style={{
            background: `${color}15`,
            color,
            border: `1px solid ${color}25`,
          }}
        >
          Generate a post for this week →
        </a>
      )}
    </div>
  )
}
