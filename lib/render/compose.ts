import { createServerClient } from '@/lib/supabase/server'
import { resolvePhotos } from '@/lib/photos/resolve'
import { planToSlides } from './shapes'
import { buildSlideHtml } from './html'
import { fontFaceCss } from './fonts'
import { renderPages } from './png'
import { storeSlides } from './store'
import { skinForStyle } from './skins'
import type { PostPlan } from '@/types'

// The in-house counterpart to lib/canva/orchestrator.ts: plan → photos → HTML
// → PNG → storage. No agent, no Canva, no session — the same plan renders to
// the same slides every time, which is the property two Canva composes of one
// post did NOT have (2026-08-13: DAHSM_Jfrd8 vs DAHSNLOxoTo differed on cover,
// photos and even headings).

export interface RenderPreview {
  schema_version: 1
  renderer: 'local'
  skin: string
  channel: 'carousel'
  outputs: Array<{ kind: 'cover' | 'slide'; page: number; url: string }>
  /** Pages the auto-fit had to squeeze — copy is too long for the shape. */
  overflow_pages: number[]
  cost_usd: number
  ts: string
}

export interface RenderOptions {
  slideSetId: string
  /** Defaults to the row's canva_style so both paths read one style id. */
  styleId?: number
}

export async function renderSlideSet({ slideSetId, styleId }: RenderOptions): Promise<RenderPreview> {
  const supabase = createServerClient()

  const { data: row, error } = await supabase
    .from('slide_sets')
    .select('id, clinic_id, slides, canva_style, clinic_categories ( name )')
    .eq('id', slideSetId)
    .maybeSingle()
  if (error) throw error
  if (!row) throw new Error(`slide_set not found: ${slideSetId}`)

  const plan = row.slides as unknown as PostPlan | null
  if (!plan?.cover || !Array.isArray(plan.slides)) {
    throw new Error('slide_set has no PostPlan — nothing to render')
  }

  const skin = skinForStyle(styleId ?? row.canva_style ?? 1)

  // Clinic logo, drawn top-right like the masters. Optional by design: a
  // clinic without a logo renders clean rather than failing.
  const { data: clinic } = await supabase
    .from('clinics')
    .select('logo_url')
    .eq('id', row.clinic_id ?? '')
    .maybeSingle()
  const logoUrl = (clinic as { logo_url?: string | null } | null)?.logo_url ?? null

  const photos = await resolvePhotos(plan.photo_brief ?? [])
  const photoByPage = new Map(photos.map((p) => [p.n, p.url]))
  const costUsd = photos.reduce((sum, p) => sum + p.costUsd, 0)

  // Cover eyebrow: the persisted plan JSONB has no `category`, so it comes
  // from the row's linked clinic_categories.
  const cat = (row as { clinic_categories?: { name?: string } | { name?: string }[] | null })
    .clinic_categories
  const chip = (Array.isArray(cat) ? cat[0]?.name : cat?.name) ?? null

  const fontCss = await fontFaceCss()
  const slides = planToSlides(plan, { chip }).map((slide) => ({
    ...slide,
    photoUrl: photoByPage.get(slide.page) ?? null,
  }))

  const pages = await renderPages(
    slides.map((slide) => buildSlideHtml({ slide, skin, fontCss, logoUrl }))
  )
  const stored = await storeSlides(slideSetId, pages)

  const preview: RenderPreview = {
    schema_version: 1,
    renderer: 'local',
    skin: skin.key,
    channel: 'carousel',
    outputs: stored.map((s) => ({
      kind: s.page === 1 ? ('cover' as const) : ('slide' as const),
      page: s.page,
      url: s.url,
    })),
    overflow_pages: pages.filter((p) => p.overflow).map((p) => p.page),
    cost_usd: Number(costUsd.toFixed(3)),
    ts: new Date().toISOString(),
  }

  // Preview slot only — render_result stays whatever Canva wrote, and the
  // status machine is not touched, so this can run on a live post safely.
  // `render_preview` lands in migration 047; types/supabase.ts is generated
  // from the deployed schema, so the cast goes away on the next regeneration.
  const { error: saveErr } = await supabase
    .from('slide_sets')
    .update({ render_preview: preview } as never)
    .eq('id', slideSetId)
  if (saveErr) throw saveErr

  return preview
}
