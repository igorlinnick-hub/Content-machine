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
  /** Clinic niche — routes to the correct compliance ruleset. */
  niche?: string | null
  // Set true to skip the LLM grade (factCheck only). Used by the cron
  // when running large batches and budget matters; the marketer UI
  // path always pays for the full grade.
  skipLLM?: boolean
}): Promise<ComplianceResult> {
  return runCompliance({
    script: input.script,
    category: input.category,
    topic: input.topic,
    niche: input.niche,
    skipLLM: input.skipLLM,
  })
}

// Map compliance verdict to the slide_sets.status the row gets
// persisted with. The pipeline writes this verbatim — never 'rendered'
// for post carousels (that legacy status implied "marketer should
// preview as PNG", which doesn't fit the script-factory + Canva-bot
// model).
//   REMOVE / REWORD → 'review'        (auto-rewrite loop ran; human sees flags but flow continues)
//   REVIEW          → 'review'
//   PASS            → 'ready_for_canva' (Canva-bot picks up on next poll)
//
// 'blocked' is no longer written by this function — it remains a valid
// DB value for legacy rows only. Compliance issues after auto-rewrite
// land in 'review' so the Canva-bot still processes them and the marketer
// sees yellow flags, not a hard stop.
export function statusFromCompliance(result: ComplianceResult): SlideSetStatusV2 {
  if (shouldBlockPublish(result)) return 'review'
  if (result.grade === 'REVIEW') return 'review'
  return 'ready_for_canva'
}

// Background auto-compose for rows that landed in 'ready_for_canva'.
// The original design expected an external Canva-bot to poll the queue,
// but no such runner is deployed — rows sat in "Queued for visuals"
// forever. When the serverless orchestrator is configured, compose
// inline right after generation (callers wrap this in waitUntil).
// Claim is atomic (ready_for_canva → in_canva), so a marketer clicking
// Compose at the same moment can't double-fire.
export async function autoComposeQueued(slideSetId: string): Promise<void> {
  const [{ canvaIsConfigured }, { autofillIsConfigured }, { composeInCanva }] =
    await Promise.all([
      import('@/lib/canva/oauth'),
      import('@/lib/canva/template-map'),
      import('@/lib/canva/orchestrator'),
    ])
  if (!canvaIsConfigured() || !autofillIsConfigured()) return

  const { createServerClient } = await import('@/lib/supabase/server')
  const supabase = createServerClient()

  const { data: row } = await supabase
    .from('slide_sets')
    .select('id, status, canva_style')
    .eq('id', slideSetId)
    .maybeSingle()
  if (!row || row.status !== 'ready_for_canva') return

  const { data: claimed } = await supabase
    .from('slide_sets')
    .update({ status: 'in_canva' })
    .eq('id', slideSetId)
    .eq('status', 'ready_for_canva')
    .select('id')
    .maybeSingle()
  if (!claimed) return

  try {
    const canvaStyle =
      (row as { canva_style?: number | null }).canva_style === 2 ? 2 : 1
    await composeInCanva({ slideSetId, canvaStyle })
  } catch (e) {
    const { ComposeCancelled, ComposeError } = await import('@/lib/canva/orchestrator')
    if (e instanceof ComposeCancelled) return // Stop pressed — status already handled
    const msg = e instanceof Error ? e.message : 'unknown'
    console.error(`[autoCompose] ${slideSetId} failed: ${msg}`)
    // Same failure semantics as the compose route: land in 'review' so
    // the marketer gets a Compose button back, not a stuck spinner —
    // and leave the reason in compose_progress for the UI.
    await supabase
      .from('slide_sets')
      .update({
        status: 'review',
        compose_progress: {
          stage: 'error',
          error: msg,
          hint: e instanceof ComposeError ? e.hint ?? null : null,
          ts: new Date().toISOString(),
        },
      } as never)
      .eq('id', slideSetId)
      .eq('status', 'in_canva')
      .then(() => undefined, () => undefined)
  }
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
