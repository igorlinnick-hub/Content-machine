// Master style templates — the single source of truth for the style→Canva
// master mapping (Igor 2026-08-10).
//
// These 5 Canva designs are the MASTER TEMPLATES the compose runner copies
// fresh for every post: it duplicates the master by `id` (= canva_style),
// swaps in the post's text + photos, and keeps the master's font, panels,
// decor, and layout. So a fix made to a master flows to every future post.
//
// Editing a master: open its Canva link, change it, done — no code change.
// The runner's skill (`~/.claude/skills/canva-compose-runner/SKILL.md`) MUST
// mirror these IDs (it's headless and can't import this file); keep both in
// sync when a master changes.
//
// Locked template standards (baked into the masters + enforced by the writer):
//   - Font: body 46pt, title 50pt — fixed, never resized per slide.
//   - Per-slide word budget: body ≤ ~20 words; list ≤ 3-4 items, each ≤ ~6
//     words; side heading ≤ ~16 chars.

export interface StyleTemplate {
  /** canva_style value stored on the slide_set; what the runner copies. */
  id: number
  key: string
  name: string
  description: string
  canvaDesignId: string
  /**
   * Cover shot of the master, shown in the style picker and the Templates
   * tab. Re-export page 1 of the master into `public/style-previews/<key>.png`
   * whenever that master's cover changes, or the picker shows a stale look.
   */
  previewImage: string
  /**
   * `clinics.niche` values allowed to pick this style. Undefined = every
   * clinic. Aesthetic is Made-only: Dr. Shawn (regenerative_medicine) must
   * not see it in the picker or the Templates tab (Igor 2026-08-11).
   */
  niches?: string[]
  /** Grouping/branding, e.g. "Made" (ManyChat). */
  under?: string
  /**
   * True when this master's COVER carries a full-bleed photo (Igor 2026-08-20).
   *
   * The photo brief is written at generation time, before anyone picks a style,
   * so the cover is briefed as `fallback` = "keep the branded surface". On a
   * photo-cover style that means the runner keeps the DONOR template's photo,
   * and the same shot reappears on every post in that style. `/compose` uses
   * this flag to rewrite the cover brief to a real, on-topic `ai` slide once
   * the style is actually known.
   */
  photoCover?: boolean
  /**
   * How many BODY pages this master ships with (total pages minus cover minus
   * CTA). Informational — NOT a cap on post length. A 2026-08-03 compose did
   * fail with "example has too few body pages" (6-slide post, 4-slot master),
   * but the runner skill was taught to grow the copy since: when the post has
   * more slides than the master has pages it duplicates body pages via
   * `merge-designs → insert_pages` instead of failing. Don't reintroduce a
   * writer-side slide cap on account of this number — it costs post depth and
   * buys nothing.
   *
   * Counts are read off each master's own page exports (`render_result.outputs`
   * from the compose that produced it), not guessed. Re-measure when a master
   * is rebuilt with a different page count.
   */
  bodySlots: number
}

export const STYLE_TEMPLATES: StyleTemplate[] = [
  {
    id: 1,
    key: 'style1',
    photoCover: true,
    name: 'Style 1',
    description: 'Diagonal translucent panels over a full-bleed photo — bold, editorial.',
    canvaDesignId: 'DAHRSR-KWdA',
    previewImage: '/style-previews/style1.png',
    // 8 pages exported (cover + 6 body + CTA) — slide_set cdbc5a8f.
    bodySlots: 6,
  },
  {
    id: 2,
    key: 'style2',
    name: 'Style 2',
    description: 'Rounded teal panels — checklist ✓ + numbered path ①②③, soft insets.',
    canvaDesignId: 'DAHQnsEktf0',
    previewImage: '/style-previews/style2.png',
    // 8 pages exported (cover + 6 body + CTA) — slide_set 8e971961.
    bodySlots: 6,
  },
  {
    id: 3,
    key: 'style3',
    name: 'Style 3',
    description: 'Editorial diagonal — dark render/photo covers with a statement + one line.',
    canvaDesignId: 'DAHRSiuJEHQ',
    previewImage: '/style-previews/style3.png',
    // 8 pages exported (cover + 6 body + CTA) — slide_set 1fad0dde.
    bodySlots: 6,
  },
  {
    id: 4,
    key: 'style4',
    photoCover: true,
    name: 'Style 4',
    description: 'Curved teal/purple panels — clean, clinical, medical-context imagery.',
    canvaDesignId: 'DAHQn_1_j2s',
    previewImage: '/style-previews/style4.png',
    // 7 pages exported (cover + 5 body + CTA) — slide_set a0409a55. The
    // tightest master; it is what caps the whole pipeline.
    bodySlots: 5,
  },
  {
    id: 5,
    key: 'aesthetic',
    photoCover: true,
    name: 'Aesthetic',
    description: 'Full-bleed photo cover, magazine feel — kept separately for Made.',
    canvaDesignId: 'DAHMHS1wLls',
    previewImage: '/style-previews/aesthetic.png',
    // UNVERIFIED — this master has never been composed by the runner, so no
    // export count exists. Held at the conservative floor until measured.
    bodySlots: 5,
    niches: ['aesthetics'],
    under: 'Made',
  },
]

/**
 * The styles a clinic is allowed to pick, given its `clinics.niche`.
 * Styles with no `niches` list are universal; Aesthetic is Made-only.
 * Niche matching mirrors getNicheProfile(): trimmed + lowercased.
 */
export function stylesForNiche(niche: string | null | undefined): StyleTemplate[] {
  const normalized = (niche ?? '').trim().toLowerCase()
  return STYLE_TEMPLATES.filter((s) => !s.niches || s.niches.includes(normalized))
}

export const canvaEditUrl = (designId: string): string =>
  `https://www.canva.com/design/${designId}/edit`

/** Style used when a row has no style set, or an unknown one. */
export const DEFAULT_STYLE_ID = 1

/**
 * Coerce a stored `canva_style` to a style that actually exists in the
 * registry. Compose paths used to clamp with `=== 2 ? 2 : 1`, which silently
 * composed styles 3/4/5 as Style 1 — the picker said one thing and the engine
 * built another (Igor 2026-08-12). Always normalise through here so a new
 * master added to STYLE_TEMPLATES is honoured everywhere at once.
 */
export function normalizeStyleId(raw: number | null | undefined): number {
  const n = Number(raw)
  return STYLE_TEMPLATES.some((s) => s.id === n) ? n : DEFAULT_STYLE_ID
}

/** The registry entry for a stored `canva_style`, normalised. */
export function getStyleTemplate(raw: number | null | undefined): StyleTemplate {
  const id = normalizeStyleId(raw)
  return STYLE_TEMPLATES.find((s) => s.id === id) ?? STYLE_TEMPLATES[0]
}

/** Canva master design id for a stored `canva_style`. */
export function designIdForStyle(raw: number | null | undefined): string {
  const id = normalizeStyleId(raw)
  return (
    STYLE_TEMPLATES.find((s) => s.id === id)?.canvaDesignId ??
    STYLE_TEMPLATES[0].canvaDesignId
  )
}

/**
 * Env var holding the Canva brand-template id for a style. Style 1 keeps the
 * original unsuffixed key for backwards compatibility; every other style is
 * `_<id>`. NOTE: the server-side autofill path these feed is inert on this
 * account (no Enterprise brand templates — see HANDOFF-MODULES.md); the live
 * carousel build is the in-session Claude+MCP runner, which copies
 * `designIdForStyle()` directly.
 */
export function brandTemplateEnvKey(raw: number | null | undefined): string {
  const id = normalizeStyleId(raw)
  return id === 1 ? 'CANVA_BRAND_TEMPLATE_ID' : `CANVA_BRAND_TEMPLATE_ID_${id}`
}

/** How many body slides the master for this style ships with. */
export function bodySlotsForStyle(raw: number | null | undefined): number {
  const id = normalizeStyleId(raw)
  return (
    STYLE_TEMPLATES.find((s) => s.id === id)?.bodySlots ??
    STYLE_TEMPLATES[0].bodySlots
  )
}
