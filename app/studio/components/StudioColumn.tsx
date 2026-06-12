'use client'

import { useState } from 'react'
import type { StudioColumn as StudioColumnData } from '@/lib/studio/slots'
import { RoleScript } from './RoleScript'

function formatViews(n: number | null): string | null {
  if (n == null) return null
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return `${n}`
}

export function StudioColumn({
  column,
  clinicId,
  onUpdate,
}: {
  column: StudioColumnData
  clinicId: string
  onUpdate: (next: StudioColumnData) => void
}) {
  const [busy, setBusy] = useState<null | 'idea' | 'video'>(null)
  const [error, setError] = useState<string | null>(null)

  async function call(action: 'regenerate-idea' | 'change-video') {
    setBusy(action === 'regenerate-idea' ? 'idea' : 'video')
    setError(null)
    try {
      const res = await fetch(
        `/api/studio/slots/${column.slot_index}/${action}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clinicId }),
        }
      )
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setError(data.error || 'Something went wrong')
        return
      }
      onUpdate(data.column as StudioColumnData)
    } catch {
      setError('Network error')
    } finally {
      setBusy(null)
    }
  }

  const views = formatViews(column.view_count)

  return (
    <div className="flex w-[340px] shrink-0 snap-start flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:w-[380px]">
      {/* Account + reach */}
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold text-neutral-900">
          {column.account ?? 'Reference video'}
        </span>
        {views && (
          <span className="shrink-0 rounded-full bg-neutral-900 px-2 py-0.5 text-[11px] font-semibold text-white">
            👁 {views}
          </span>
        )}
      </div>

      {/* Video — plays inline */}
      {column.video_url ? (
        <video
          controls
          preload="metadata"
          poster={column.thumbnail_url ?? undefined}
          className="aspect-[9/16] w-full rounded-xl bg-neutral-900 object-cover"
          src={column.video_url}
        />
      ) : (
        <div className="flex aspect-[9/16] w-full items-center justify-center rounded-xl bg-neutral-100 text-sm text-neutral-400">
          No video
        </div>
      )}

      {/* Change video — pulls the next video from the clinic's base */}
      <button
        type="button"
        onClick={() => call('change-video')}
        disabled={busy !== null}
        className="cm-btn cm-btn-ghost w-full text-xs"
      >
        {busy === 'video' ? 'Loading another…' : '🔄 Change video'}
      </button>

      {/* Structure schema */}
      {column.schema_beats.length > 0 && (
        <div className="rounded-xl bg-neutral-50 p-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Structure
          </p>
          <ol className="flex flex-col gap-1.5">
            {column.schema_beats.map((b, i) => (
              <li key={i} className="text-xs text-neutral-700">
                <span className="font-semibold text-neutral-900">{b.name}</span>
                {b.text ? ` — ${b.text}` : ''}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Template — collapsed */}
      {column.template_scaffold && (
        <details className="rounded-xl border border-neutral-200 p-3">
          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Template · read more
          </summary>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-relaxed text-neutral-700">
            {column.template_scaffold}
          </pre>
        </details>
      )}

      {/* Idea: steps + roles */}
      <div className="rounded-xl border border-sky-100 bg-sky-50/40 p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-sky-600">
          Your idea
        </p>
        {column.idea ? (
          <>
            {column.idea.topic && (
              <p className="mb-1 text-sm font-semibold text-neutral-900">
                {column.idea.topic}
              </p>
            )}
            {column.idea.hook && (
              <p className="mb-3 text-sm font-medium text-sky-800">
                “{column.idea.hook}”
              </p>
            )}

            {column.idea.steps && column.idea.steps.length > 0 && (
              <div className="mb-3">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  What we&apos;ll film
                </p>
                <ol className="ml-4 list-decimal flex flex-col gap-1">
                  {column.idea.steps.map((s, i) => (
                    <li key={i} className="text-xs text-neutral-700">
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Script — who says what
            </p>
            <RoleScript
              roleBlocks={column.idea.role_blocks}
              fallbackScript={column.idea.script}
            />
          </>
        ) : (
          <p className="text-sm text-neutral-500">
            No idea yet — generate one below.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => call('regenerate-idea')}
        disabled={busy !== null || !column.video_id}
        className="cm-btn cm-btn-primary w-full text-xs"
      >
        {busy === 'idea' ? 'Thinking…' : '✨ Regenerate idea'}
      </button>

      {/* Basic filming rules — same every card, static */}
      <div className="rounded-xl bg-neutral-50 p-3">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Filming basics
        </p>
        <ul className="flex flex-col gap-1 text-xs text-neutral-600">
          <li>• Film inside the clinic</li>
          <li>• Phone vertical (9:16), face the light</li>
          <li>• Quiet room, talk close for clean audio</li>
          <li>• One take, keep it under 60s</li>
          <li>• Editor adds on-screen images &amp; captions after</li>
        </ul>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
