'use client'

import type { RoleBlock } from '@/types'

// Render the speaking content of a script without production notes.
// Operator blocks (editing/post-production instructions) and direction
// notes (🎬 stage cues) are stripped — only what gets spoken survives.
// Speaker labels are dropped too: the idea reads as continuous prose.

export function RoleScript({
  roleBlocks,
  fallbackScript,
}: {
  roleBlocks: RoleBlock[] | null
  fallbackScript: string
}) {
  if (!roleBlocks || roleBlocks.length === 0) {
    return (
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
        {fallbackScript}
      </p>
    )
  }

  const speakingLines = roleBlocks.filter(
    (b) => b.speaker !== 'Operator' && b.text && b.text.trim()
  )

  if (speakingLines.length === 0) {
    return (
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
        {fallbackScript}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {speakingLines.map((b, i) => (
        <p key={i} className="text-sm leading-relaxed text-neutral-800">
          {b.text}
        </p>
      ))}
    </div>
  )
}
