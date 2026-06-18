import type {
  PostPlanBodySlide,
  PostPlanCover,
  PostPlanCta,
  PostPlanPhotoBrief,
} from '@/types'
import type { AutofillValue } from './api'

// Maps a PostPlan + per-slide photo asset_ids to the Canva brand-
// template autofill `data` payload.
//
// Field naming convention (matches what the parallel Canva chat will
// have set up in the HWC brand template):
//
//   cover_title         text
//   cover_hook          text
//   cover_photo         image
//
//   slide_N_heading     text         (N = 2..6)
//   slide_N_intro       text
//   slide_N_bullet_1    text         (filled if bullets[0] exists)
//   slide_N_bullet_2    text
//   slide_N_bullet_3    text
//   slide_N_bullet_4    text
//   slide_N_close       text
//   slide_N_photo       image
//
//   cta_keyword         text
//   cta_follow          text
//   cta_comment         text
//   cta_book            text
//   cta_crisis          text         (only present for mental-health-acute)
//
// If the template uses different names, supply an override JSON in
// CANVA_TEMPLATE_FIELDS_JSON env var: {"cover_title": "title_main"}
// shifts our cover_title → title_main when calling Canva.

type FieldRemap = Record<string, string>

function loadRemap(): FieldRemap {
  const raw = process.env.CANVA_TEMPLATE_FIELDS_JSON
  if (!raw) return {}
  try {
    const obj = JSON.parse(raw) as unknown
    if (!obj || typeof obj !== 'object') return {}
    const out: FieldRemap = {}
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof v === 'string' && v.length > 0) out[k] = v
    }
    return out
  } catch {
    return {}
  }
}

function text(value: string): AutofillValue {
  return { type: 'text', text: value }
}

function image(asset_id: string): AutofillValue {
  return { type: 'image', asset_id }
}

interface BuildArgs {
  cover: PostPlanCover
  slides: PostPlanBodySlide[]
  cta: PostPlanCta
  photoBrief: PostPlanPhotoBrief[]
  // Map of slide n → uploaded Canva asset id. Cover is n=1; CTA gets
  // no photo by default. Missing entries fall back to whatever the
  // template's placeholder default is.
  photoAssetIds: Map<number, string>
}

export function buildAutofillData(args: BuildArgs): Record<string, AutofillValue> {
  const remap = loadRemap()
  const put = (
    canonical: string,
    value: AutofillValue,
    out: Record<string, AutofillValue>
  ) => {
    const target = remap[canonical] ?? canonical
    out[target] = value
  }
  const data: Record<string, AutofillValue> = {}

  // Cover.
  put('cover_title', text(args.cover.title), data)
  if (args.cover.hook) put('cover_hook', text(args.cover.hook), data)
  const coverAsset = args.photoAssetIds.get(1)
  if (coverAsset) put('cover_photo', image(coverAsset), data)

  // Body slides — index from PostPlan's own `n` field (2..N).
  for (const s of args.slides) {
    const prefix = `slide_${s.n}`
    if (s.heading) put(`${prefix}_heading`, text(s.heading), data)
    if (s.intro) put(`${prefix}_intro`, text(s.intro), data)
    if (Array.isArray(s.bullets)) {
      s.bullets.slice(0, 4).forEach((b, i) => {
        put(`${prefix}_bullet_${i + 1}`, text(b), data)
      })
    }
    if (s.close) put(`${prefix}_close`, text(s.close), data)
    const photoAsset = args.photoAssetIds.get(s.n)
    if (photoAsset) put(`${prefix}_photo`, image(photoAsset), data)
  }

  // CTA stack.
  put('cta_keyword', text(args.cta.keyword), data)
  if (args.cta.follow_line) put('cta_follow', text(args.cta.follow_line), data)
  if (args.cta.comment_line) put('cta_comment', text(args.cta.comment_line), data)
  if (args.cta.book_line) put('cta_book', text(args.cta.book_line), data)
  if (args.cta.crisis_line_in_cta) {
    put('cta_crisis', text(args.cta.crisis_line_in_cta), data)
  }

  return data
}

// True when the user has set the env vars required for an actual
// autofill call. brand_template_id is required; field remap is optional.
export function autofillIsConfigured(): boolean {
  return !!(
    process.env.CANVA_BRAND_TEMPLATE_ID &&
    process.env.CANVA_BRAND_TEMPLATE_ID.trim().length > 0
  )
}
