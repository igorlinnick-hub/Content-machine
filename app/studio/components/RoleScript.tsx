'use client'

import type { RoleBlock, SpeakerRole } from '@/types'

// Per-speaker accent so the team can scan "who says what" at a glance.
const SPEAKER_STYLE: Record<SpeakerRole, string> = {
  Doctor: 'bg-sky-100 text-sky-800',
  Patient: 'bg-emerald-100 text-emerald-800',
  Assistant: 'bg-violet-100 text-violet-800',
  Narrator: 'bg-neutral-200 text-neutral-700',
}

export function RoleScript({
  roleBlocks,
  fallbackScript,
}: {
  roleBlocks: RoleBlock[] | null
  fallbackScript: string
}) {
  // Monologue (no roles) — render the plain script.
  if (!roleBlocks || roleBlocks.length === 0) {
    return (
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
        {fallbackScript}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {roleBlocks.map((b, i) => (
        <div key={i} className="flex flex-col gap-1">
          <span
            className={`w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
              SPEAKER_STYLE[b.speaker] ?? 'bg-neutral-200 text-neutral-700'
            }`}
          >
            {b.speaker}
          </span>
          <p className="text-sm leading-relaxed text-neutral-800">{b.text}</p>
          {b.direction && (
            <p className="text-xs italic text-neutral-500">🎬 {b.direction}</p>
          )}
        </div>
      ))}
    </div>
  )
}
