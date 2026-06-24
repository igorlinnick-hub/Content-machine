import type { SlideSetStatus } from '@/types'

// Single source of truth for "who moves this row + what plate the user
// sees". The contract (HANDOFF-POSTS.md §22 + 2026-06-17 runner spec)
// fixes both — keep this table and the spec doc in lockstep.

export type StatusOwner = 'system' | 'human-medical' | 'marketer' | 'runner' | 'manual'

export interface StatusMeta {
  owner: StatusOwner
  // Short label shown to the marketer.
  label: string
  // One-liner explaining what's happening / what they should do.
  hint: string
  // Tailwind classes for the chip — keeps colour vocabulary consistent.
  chipClass: string
}

const STATUS_META: Record<SlideSetStatus, StatusMeta> = {
  pending: {
    owner: 'system',
    label: 'Preparing…',
    hint: 'Running the compliance grade and packing the script.',
    chipClass: 'border-neutral-200 bg-neutral-50 text-neutral-700',
  },
  review: {
    owner: 'human-medical',
    label: 'Needs medical review',
    hint: 'Compliance flagged items that need a human call. Read the findings below, then either proceed to Canva or regenerate.',
    chipClass: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  blocked: {
    owner: 'marketer',
    label: 'Has a problem — fix needed',
    hint: 'Compliance returned REMOVE/REWORD findings. Open the post, fix the listed issues, then regenerate.',
    chipClass: 'border-red-200 bg-red-50 text-red-700',
  },
  ready_for_canva: {
    owner: 'runner',
    label: 'Queued for visuals',
    hint: 'Waiting for the Canva runner to pick this up. Usually ~2 min; if it stays here for 10+ min the runner may be down.',
    chipClass: 'border-violet-200 bg-violet-50 text-violet-700',
  },
  in_canva: {
    owner: 'runner',
    label: 'Drawing carousel…',
    hint: 'Runner is generating photos and assembling slides in Canva.',
    chipClass: 'border-violet-200 bg-violet-100 text-violet-800',
  },
  visuals_ready: {
    owner: 'marketer',
    label: 'Ready to review',
    hint: 'Visuals are done. Open in Canva, scan the slides, then Approve when happy.',
    chipClass: 'border-sky-200 bg-sky-50 text-sky-700',
  },
  approved: {
    owner: 'marketer',
    label: 'Approved (draft)',
    hint: 'Approved but not published yet. Publish manually to Instagram / Buffer, then mark Published.',
    chipClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  published: {
    owner: 'manual',
    label: 'Published',
    hint: 'Live on the channel.',
    chipClass: 'border-emerald-300 bg-emerald-100 text-emerald-800',
  },
  // Legacy values — never set by the new pipeline but may exist on old rows.
  rendered: {
    owner: 'marketer',
    label: 'Legacy (rendered)',
    hint: 'Pre-contract row. Treat as review.',
    chipClass: 'border-neutral-200 bg-neutral-50 text-neutral-700',
  },
  exported: {
    owner: 'marketer',
    label: 'Legacy (exported)',
    hint: 'Pre-contract row. Treat as approved.',
    chipClass: 'border-neutral-200 bg-neutral-50 text-neutral-700',
  },
}

export function statusMeta(status: SlideSetStatus | string | null | undefined): StatusMeta {
  const key = (status ?? 'pending') as SlideSetStatus
  return STATUS_META[key] ?? STATUS_META.pending
}

// True when the row is moving on its own (system or runner working).
// The UI polls while this is true so the user sees status changes
// without manually refreshing.
export function isActivelyMoving(status: SlideSetStatus | string | null | undefined): boolean {
  return status === 'pending' || status === 'ready_for_canva' || status === 'in_canva'
}

// True when the marketer can press "Compose in Canva" to queue render.
// We allow it on:
//   • review            — compliance flagged, but marketer can still queue
//   • ready_for_canva   — for "kick the runner" / retry semantics
//   • visuals_ready     — re-render (existing render_result will be overwritten)
//   • approved          — re-render an approved post (rare but legal)
// Blocked is refused (server rejects it, mirror here).
export function canCompose(status: SlideSetStatus | string | null | undefined): boolean {
  return (
    status === 'review' ||
    status === 'ready_for_canva' ||
    status === 'visuals_ready' ||
    status === 'approved' ||
    status === 'rendered' ||
    status === 'exported'
  )
}
