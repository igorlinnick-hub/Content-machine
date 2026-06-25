import { createServerClient } from '@/lib/supabase/server'
import { generateImages } from '@/lib/replicate/images'
import type { Json } from '@/types/supabase'
import type {
  PostPlanBodySlide,
  PostPlanCover,
  PostPlanCta,
  PostPlanPhotoBrief,
  RenderResult,
} from '@/types'
import { canvaIsConfigured } from './oauth'
import { createAutofillDesign, uploadAssetFromUrl } from './api'
import { autofillIsConfigured, buildAutofillData } from './template-map'

// End-to-end Canva compose orchestrator.
//
// Input:  slide_set_id
// Steps:
//   1. Load slides JSONB (PostPlan) + topic.
//   2. For each photo_brief entry with source='ai' → Flux Pro
//      generates a 4:5 image in parallel.
//   3. For each generated image URL → Canva uploadAsset (parallel).
//   4. Build the autofill `data` map per template-map.ts conventions.
//   5. POST /autofills + poll until success.
//   6. Write render_result JSONB + status='visuals_ready'.
//
// Cost (per post, Jun 2026 Replicate pricing):
//   • 4-6 Flux Pro images × ~$0.04   = $0.16-0.24
//   • Canva calls                    = $0 (included in workspace plan)
//   • Total                          ≈ $0.20-0.25
//
// Time budget (sequential where Canva forces it, parallel otherwise):
//   • Flux parallel                  ≈ 30-60s
//   • Asset uploads parallel         ≈ 5-15s
//   • Autofill job poll              ≈ 10-30s
//   • Total                          ≈ 60-120s (well under maxDuration=300)

const FLUX_TIMEOUT_MS = 120_000

export class ComposeError extends Error {
  readonly hint?: string
  constructor(message: string, hint?: string) {
    super(message)
    this.name = 'ComposeError'
    this.hint = hint
  }
}

// Lightweight stage emitter so the compose endpoint can stream
// progress to the UI later (mirrors the generate route's onStage hook).
export type ComposeStageEmitter = (
  name: string,
  meta?: Record<string, unknown>
) => void

interface PlanRow {
  cover: PostPlanCover
  slides: PostPlanBodySlide[]
  cta: PostPlanCta
  photo_brief?: PostPlanPhotoBrief[]
}

export async function composeInCanva(params: {
  slideSetId: string
  canvaStyle?: 1 | 2
  onStage?: ComposeStageEmitter
}): Promise<RenderResult> {
  const { slideSetId, canvaStyle = 1, onStage } = params
  const stage = (n: string, meta?: Record<string, unknown>) => {
    onStage?.(n, meta)
    console.log(`[compose] ${n}`)
  }

  if (!canvaIsConfigured() || !autofillIsConfigured()) {
    throw new ComposeError(
      'Canva not configured',
      'Set CANVA_CLIENT_ID, CANVA_CLIENT_SECRET, CANVA_REFRESH_TOKEN, and CANVA_BRAND_TEMPLATE_ID in Vercel env.'
    )
  }

  stage('load:start')
  const supabase = createServerClient()
  const { data: row, error: loadErr } = await supabase
    .from('slide_sets')
    .select('id, slides, scripts(topic)')
    .eq('id', slideSetId)
    .maybeSingle()
  if (loadErr || !row) {
    throw new ComposeError(`slide_set ${slideSetId} not found: ${loadErr?.message ?? 'no row'}`)
  }
  const plan = row.slides as PlanRow | null
  if (!plan || !plan.cover || !Array.isArray(plan.slides) || !plan.cta) {
    throw new ComposeError('slide_set.slides is not a PostPlan — regenerate the post first.')
  }
  const photoBrief: PostPlanPhotoBrief[] = Array.isArray(plan.photo_brief)
    ? plan.photo_brief
    : []
  const scripts = Array.isArray(row.scripts) ? row.scripts[0] : row.scripts
  const topic = (scripts as { topic?: string | null } | null | undefined)?.topic ?? null
  stage('load:done', { slide_count: plan.slides.length })

  // ── Stage A: generate photos in parallel ────────────────────────
  stage('photos:start', {
    ai_count: photoBrief.filter((b) => b.source === 'ai').length,
  })
  const photoResults = await Promise.all(
    photoBrief.map(async (b) => {
      if (b.source !== 'ai' || !b.prompt) return { n: b.n, imageUrl: null as string | null }
      try {
        const r = await generateImages({
          model: 'flux_pro',
          input: { prompt: b.prompt, aspect_ratio: '4:5', num_outputs: 1 },
          maxWaitMs: FLUX_TIMEOUT_MS,
        })
        const imageUrl = r.imageUrls[0] ?? null
        return { n: b.n, imageUrl }
      } catch (e) {
        console.warn(
          `[compose] flux failed for slide n=${b.n}: ${
            e instanceof Error ? e.message : 'unknown'
          }`
        )
        return { n: b.n, imageUrl: null }
      }
    })
  )
  stage('photos:done', {
    generated: photoResults.filter((r) => r.imageUrl !== null).length,
  })

  // ── Stage B: upload each generated image to Canva ───────────────
  stage('upload:start')
  const uploadResults = await Promise.all(
    photoResults.map(async (r) => {
      if (!r.imageUrl) return { n: r.n, assetId: null as string | null }
      try {
        const name = topic ? `${topic} · slide ${r.n}` : `slide ${r.n}`
        const assetId = await uploadAssetFromUrl(r.imageUrl, name)
        return { n: r.n, assetId }
      } catch (e) {
        console.warn(
          `[compose] canva upload failed for slide n=${r.n}: ${
            e instanceof Error ? e.message : 'unknown'
          }`
        )
        return { n: r.n, assetId: null }
      }
    })
  )
  const photoAssetIds = new Map<number, string>()
  for (const u of uploadResults) {
    if (u.assetId) photoAssetIds.set(u.n, u.assetId)
  }
  stage('upload:done', { uploaded: photoAssetIds.size })

  // ── Stage C: autofill brand template ────────────────────────────
  stage('autofill:start')
  const envKey = canvaStyle === 2 ? 'CANVA_BRAND_TEMPLATE_ID_2' : 'CANVA_BRAND_TEMPLATE_ID'
  const brandTemplateId = (process.env[envKey] ?? '').trim()
  if (!brandTemplateId) {
    throw new ComposeError(
      `${envKey} is not set`,
      `Add ${envKey} to Vercel env vars and redeploy.`
    )
  }
  const data = buildAutofillData({
    cover: plan.cover,
    slides: plan.slides,
    cta: plan.cta,
    photoBrief,
    photoAssetIds,
  })
  const autofill = await createAutofillDesign({
    brand_template_id: brandTemplateId,
    title: topic ?? `HWC carousel ${slideSetId.slice(0, 8)}`,
    data,
  })
  stage('autofill:done', { design_id: autofill.designId })

  // ── Stage D: write render_result + flip status ──────────────────
  const result: RenderResult = {
    schema_version: 1,
    channel: 'carousel',
    canva_edit_url: autofill.editUrl,
    outputs: autofill.thumbnailUrl
      ? [{ kind: 'cover', page: 1, url: autofill.thumbnailUrl }]
      : [],
    assets_used: Array.from(photoAssetIds.values()),
    cost_usd:
      uploadResults.filter((u) => u.assetId).length * 0.04, // Flux Pro est.
    ts: new Date().toISOString(),
  }
  const { error: updErr } = await supabase
    .from('slide_sets')
    .update({
      render_result: result as unknown as Json,
      status: 'visuals_ready',
    })
    .eq('id', slideSetId)
  if (updErr) {
    throw new ComposeError(`failed to save render_result: ${updErr.message}`)
  }
  stage('save:done')
  return result
}
