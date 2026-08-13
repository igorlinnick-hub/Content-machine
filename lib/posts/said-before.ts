// "Already said" — cross-post repetition guard (Igor 2026-08-12).
//
// The writer is stateless: it sees one topic and no memory of the clinic's
// earlier carousels, so the same well-turned sentence resurfaces post after
// post. Caught live — "a 44- and a 72-year-old share the same range" shipped
// on TWO different styles (DAHQn_1_j2s p3 and DAHRSiuJEHQ p4), which reads to
// a follower as the clinic recycling copy.
//
// Prompt-only fix: pull the lines this clinic has already published and hand
// them to the writer as a do-not-reuse list. Goes in the USER content, never
// the system prompt — the system block is prompt-cached and must stay stable.

import type { PostPlanBodySlide, PostPlanCover } from '@/types'

/** How many recent posts to look back over. */
const LOOKBACK_POSTS = 12
/** Cap the block so it can't crowd out the brief on a long-running clinic. */
const MAX_LINES = 40

interface StoredPlan {
  cover?: PostPlanCover | null
  slides?: PostPlanBodySlide[] | null
}

/**
 * The memorable lines of one stored PostPlan: the cover hook, each slide
 * heading, and each slide's takeaway. Body prose is skipped on purpose —
 * repeating a *fact* across posts is fine and often necessary; repeating a
 * turn of phrase or a slide title is what looks like recycling.
 */
function linesFromPlan(plan: StoredPlan): string[] {
  const out: string[] = []
  const hook = plan.cover?.hook?.trim()
  if (hook) out.push(hook)
  for (const s of plan.slides ?? []) {
    const heading = s?.heading?.trim()
    if (heading) out.push(heading)
    const close = s?.close?.trim()
    if (close) out.push(close)
  }
  return out
}

/** Normalised key for near-duplicate detection. */
function fingerprint(line: string): string {
  return line
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Lines this clinic has already used, newest first. Best-effort: any DB
 * problem returns [] so a generation never fails over the repetition guard.
 */
export async function fetchSaidBefore(clinicId: string): Promise<string[]> {
  try {
    const { createServerClient } = await import('@/lib/supabase/server')
    const supabase = createServerClient()
    const { data } = await supabase
      .from('slide_sets')
      .select('slides, created_at')
      .eq('clinic_id', clinicId)
      .neq('status', 'generating')
      .order('created_at', { ascending: false })
      .limit(LOOKBACK_POSTS)
    if (!data) return []

    const seen = new Set<string>()
    const lines: string[] = []
    for (const row of data as Array<{ slides: unknown }>) {
      const plan = (row.slides ?? {}) as StoredPlan
      for (const line of linesFromPlan(plan)) {
        // Placeholder rows carry an empty plan; skip one-word noise.
        if (line.split(/\s+/).length < 3) continue
        const fp = fingerprint(line)
        if (!fp || seen.has(fp)) continue
        seen.add(fp)
        lines.push(line)
        if (lines.length >= MAX_LINES) return lines
      }
    }
    return lines
  } catch {
    return []
  }
}

/** Prompt block for the writer's USER content. Empty string when nothing to say. */
export function saidBeforePromptBlock(lines: string[]): string {
  if (!lines.length) return ''
  const list = lines.map((l) => `  - ${l}`).join('\n')
  return `\n\nALREADY SAID ON THIS CLINIC'S RECENT POSTS — do NOT reuse these lines, and do not reword them into near-copies. A follower sees these posts back to back; a repeated slide title or takeaway reads as recycled copy. Reusing the same FACT is fine when the post needs it — say it a different way, from a different angle, in a different position in the arc.\n${list}\n`
}
