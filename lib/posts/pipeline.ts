import type {
  ComplianceResult,
  SlideSetStatusV2,
} from '@/types'
import { runCompliance, shouldBlockPublish } from '@/lib/agents/compliance'

// Shared compliance + lifecycle helpers used by all three generation
// paths (HANDOFF-POSTS.md §22.2): admin UI, Canva-bot trigger, cron.
//
// The actual generation work (writer / critic / splitter / renderer)
// still lives in app/api/posts/generate/route.ts to avoid a big-bang
// refactor. This module owns ONLY:
//   1. running the compliance gate on a final-winner script
//   2. mapping the verdict to a slide_sets.status value
//   3. picking the next plan_id from content_plan_topics rotation

// Pass a ready-to-grade script through the gate. Thin wrapper so callers
// don't have to import lib/agents/compliance.ts directly — keeps the
// pipeline boundary visible.
export async function runComplianceGate(input: {
  script: string
  category?: string | null
  topic?: string | null
  // Set true to skip the LLM grade (factCheck only). Used by the cron
  // when running large batches and budget matters; the marketer UI
  // path always pays for the full grade.
  skipLLM?: boolean
}): Promise<ComplianceResult> {
  return runCompliance({
    script: input.script,
    category: input.category,
    topic: input.topic,
    skipLLM: input.skipLLM,
  })
}

// Map compliance verdict + render outcome to the slide_sets.status that
// the row should be persisted with. The pipeline writes this verbatim.
//
//   REMOVE / REWORD → 'blocked'    (Canva-bot ignores; UI flags for fix)
//   REVIEW          → 'rendered'   (legacy preview path; marketer reviews)
//   PASS            → 'ready_for_canva' (Canva-bot picks up next poll)
//
// The 'rendered' legacy value is intentional for REVIEW — it keeps the
// existing UI behaviour where REVIEW posts show up for marketer review
// without auto-publishing. The compliance JSONB is the source of truth
// for "why this is still pending".
export function statusFromCompliance(result: ComplianceResult): SlideSetStatusV2 {
  if (shouldBlockPublish(result)) return 'blocked'
  if (result.grade === 'REVIEW') return 'rendered'
  return 'ready_for_canva'
}

// Pick the next post in the editorial rotation for a clinic. Returns the
// content_plan_topics row whose cycle_position is smallest among rows
// not yet attached to a ready_for_canva or published slide_set in this
// cycle. Used by the cron entry.
//
// Implementation note: this query is intentionally simple — one row per
// call, no batching. The cron runs Mon/Wed/Fri so the rotation has
// natural pacing. For high-frequency clinics, extend this with a cycle
// number column on content_plan_topics.
export async function pickNextPlanForClinic(
  clinicId: string
): Promise<{
  plan_handle: string
  topic: string
  cycle_position: number
} | null> {
  const { createServerClient } = await import('@/lib/supabase/server')
  const supabase = createServerClient()

  // 1. Get the set of plan_handle values already in ready_for_canva /
  //    in_canva / published state for this clinic in slide_sets.
  const { data: doneRows } = await supabase
    .from('slide_sets')
    .select('plan_id')
    .eq('clinic_id', clinicId)
    .in('status', ['ready_for_canva', 'in_canva', 'published'])

  const done = new Set(
    (doneRows ?? [])
      .map((r) => (r as { plan_id?: string | null }).plan_id)
      .filter((p): p is string => typeof p === 'string' && p.length > 0)
  )

  // 2. Get the plan rotation rows ordered by cycle_position.
  const { data: planRows, error } = await supabase
    .from('content_plan_topics')
    .select('topic, position, plan_handle, cycle_position')
    .eq('clinic_id', clinicId)
    .not('cycle_position', 'is', null)
    .order('cycle_position', { ascending: true })
  if (error || !planRows) return null

  // 3. First row whose plan_handle is not yet done.
  for (const row of planRows) {
    const handle = (row as { plan_handle?: string | null }).plan_handle
    const pos = (row as { cycle_position?: number | null }).cycle_position
    const topic = (row as { topic?: string | null }).topic
    if (!handle || typeof pos !== 'number' || !topic) continue
    if (done.has(handle)) continue
    return { plan_handle: handle, topic, cycle_position: pos }
  }
  return null
}

// Auth helper — checks if the request carries a valid SERVICE_TOKEN.
// Used by the generate route, the cron route, and the ready-for-canva
// poll route. Returns the token kind so callers can branch on it.
export function checkServiceToken(req: Request): boolean {
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return false
  const token = auth.slice(7).trim()
  if (!token) return false
  const expected = process.env.SERVICE_TOKEN
  if (!expected) return false
  return token === expected
}

// Auth helper for cron — checks CRON_SECRET on the Authorization header
// (Vercel cron convention) OR the legacy ?secret= query param.
export function checkCronAuth(req: Request): boolean {
  const auth = req.headers.get('authorization') ?? ''
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  if (auth === `Bearer ${expected}`) return true
  try {
    const url = new URL(req.url)
    if (url.searchParams.get('secret') === expected) return true
  } catch {
    // ignore — malformed url
  }
  return false
}
