import type { PostPlan, PostPlanBodySlide } from '@/types'
import type { RenderSlide } from './types'

// PostPlan → RenderSlide[]. Pure, no I/O — the same plan always yields the
// same slides, which is the property the Canva runner could never offer
// (two composes of one post produced visibly different carousels).
//
// The shape is DERIVED from the data we already store, so nothing new has to
// be written by the writer or the splitter: a body slide with bullets is a
// list, otherwise it is prose.

/** Markers the writer/runner may have baked into a bullet; the skin draws its own. */
const MARKER = /^\s*(?:[✓✔•\-–]|[①②③④⑤⑥⑦⑧⑨]|\d+[.)])\s*/

function cleanItem(s: string): string {
  return s.replace(MARKER, '').trim()
}

/**
 * Cover eyebrow. `plan.category` is part of the PostPlan type but is NOT in
 * the persisted `slide_sets.slides` JSONB (that row keeps cover/slides/cta/
 * sources/photo_brief only), so the caller passes the category name it read
 * off the slide_set. Falls back to whatever the plan itself carries.
 */
function chipFor(plan: PostPlan, override?: string | null): string | null {
  const category = (override ?? plan.category)?.trim()
  if (!category) return null
  return category.toUpperCase()
}

/**
 * The CTA slide already sets the keyword large ("Comment “APPETITE”"), so the
 * comment line must not repeat it — printed as written you get the keyword
 * twice, two lines apart. Drop the leading `Comment → "KEYWORD"` and keep the
 * promise, which is the part that actually earns the comment.
 */
function stripKeywordPrefix(line: string | null | undefined, keyword: string | null | undefined): string | null {
  const text = line?.trim()
  if (!text) return null
  if (!keyword) return text
  const pattern = new RegExp(
    `^comment\\s*(?:→|->|:)?\\s*["“']?${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["”']?\\s*(?:and\\s+)?`,
    'i'
  )
  const stripped = text.replace(pattern, '').trim()
  if (!stripped) return null
  return stripped.charAt(0).toUpperCase() + stripped.slice(1)
}

function bodyOf(slide: PostPlanBodySlide): string | null {
  const intro = slide.intro?.trim()
  return intro && intro.length > 0 ? intro : null
}

export interface PlanToSlidesOptions {
  /** Category name for the cover eyebrow, read off the slide_set row. */
  chip?: string | null
}

export function planToSlides(plan: PostPlan, opts: PlanToSlidesOptions = {}): RenderSlide[] {
  const out: RenderSlide[] = []

  out.push({
    page: 1,
    shape: 'cover',
    chip: chipFor(plan, opts.chip),
    heading: plan.cover.title?.trim() || null,
    body: plan.cover.hook?.trim() || null,
  })

  const bodySlides = plan.slides ?? []
  for (let i = 0; i < bodySlides.length; i++) {
    const slide = bodySlides[i]
    const items = (slide.bullets ?? [])
      .map(cleanItem)
      .filter((s: string) => s.length > 0)
    out.push({
      page: i + 2,
      shape: items.length > 0 ? 'list' : 'prose',
      heading: slide.heading?.trim() || null,
      body: bodyOf(slide),
      items,
      takeaway: slide.close?.trim() || null,
    })
  }

  // CTA lines in the order they read on the slide. Any of them can be null
  // (the mental-health-acute variant strips follow/book), so filter after.
  const cta = plan.cta
  const ctaLines = [
    stripKeywordPrefix(cta?.comment_line, cta?.keyword),
    cta?.follow_line,
    cta?.book_line,
    cta?.crisis_line_in_cta,
  ]
    .map((l) => l?.trim())
    .filter((l): l is string => !!l && l.length > 0)

  out.push({
    page: out.length + 1,
    shape: 'cta',
    ctaKeyword: cta?.keyword?.trim() || null,
    ctaLines,
  })

  return out
}
