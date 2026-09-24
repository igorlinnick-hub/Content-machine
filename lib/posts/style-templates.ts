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
    // 8 pages counted on the master itself (cover + 6 body + CTA) — Igor
    // 2026-08-27, when the master was rebuilt to the editorial standard.
    bodySlots: 6,
    niches: ['aesthetics'],
    under: 'Made',
  },
  {
    id: 6,
    key: 'yedino',
    // No photography anywhere in this master — type + one accent colour.
    // Leaving photoCover true made coverBriefForStyle() rewrite slide 1 into
    // an `ai` photo that nothing would ever place.
    photoCover: false,
    name: 'Yedino Carousel',
    description: 'Accent-swap master — one colour changes per post (docs/YEDINO-STYLE.md §12).',
    // Master picked by Igor 2026-09-14. NOT yet verified against the spec:
    // nobody with Canva access has read its pages, so page count, layer names
    // and the §7 invariants are unconfirmed. See the handoff.
    canvaDesignId: 'DAHVZUyzxTg',
    previewImage: '/style-previews/yedino.png',
    // MEASURED off the design itself 2026-09-16 (page navigator read "6 / 6"):
    // cover + 4 body + CTA = 6 pages. The earlier 3 was a guess and was wrong.
    bodySlots: 4,
    niches: ['yedino'],
    under: 'Yedino',
  },
]

/**
 * The styles a clinic is allowed to pick, given its `clinics.niche`.
 * Styles with no `niches` list are universal; Aesthetic is Made-only.
 * Niche matching mirrors getNicheProfile(): trimmed + lowercased.
 */
export function stylesForNiche(niche: string | null | undefined): StyleTemplate[] {
  const normalized = (niche ?? '').trim().toLowerCase()
  // An aesthetics clinic gets ONLY its own look (Igor 2026-08-20). Dr. Made's
  // brand is the Aesthetic master; the regenmed styles were still offered in
  // his picker and had no business being there. This is the mirror of the
  // `niches` rule below, which keeps Aesthetic out of everyone else's picker.
  const own = STYLE_TEMPLATES.filter((s) => s.niches?.includes(normalized))
  if (own.length > 0) return own
  return STYLE_TEMPLATES.filter((s) => !s.niches)
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

/**
 * The style a NEW post starts in, given the clinic's `clinics.niche` — the
 * first style that niche is allowed to pick. The column defaults to 1, which
 * is a regenmed master: every Made post was born in Dr. Shawn's Style 1 and
 * composed with his design elements unless someone re-picked the style by
 * hand (Igor 2026-08-27). A niche with its own look must start in it.
 */
export function defaultStyleForNiche(niche: string | null | undefined): number {
  return stylesForNiche(niche)[0]?.id ?? DEFAULT_STYLE_ID
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

// ── Yedino Systems — the agency's OWN account (@yedino.systems) ─────
//
// Yedino is a client of this machine like any clinic: it gets scripts and a
// carousel. It is style 6, gated by `niches: ['yedino']`, which is what makes
// the Canva carousel its ONLY option — `stylesForNiche('yedino')` returns just
// this one, and the five HWC styles never appear in its picker (nor does
// Yedino appear in theirs). Same mechanism that keeps Aesthetic Made-only.
//
// Its visual system is `docs/YEDINO-STYLE.md` — BINDING, and it outranks the
// master: when the master is rebuilt, the spec's §7 invariants are what the
// new one has to satisfy. Brand kit is Yedino's own, NOT HWC's `kAG87QCkJl0`.
//
// ⚠️ Not in `lib/canva/templates.ts`: that file is dead code with a stale HWC
// set that nothing imports (HANDOFF-MODULES.md:554).

export const YEDINO_STYLE_ID = 6
export const YEDINO_NICHE = 'yedino'

/**
 * Field contract from docs/YEDINO-STYLE.md §9, in page order. Names follow the
 * `lib/canva/template-map.ts` convention so the master's layers stay labelled
 * consistently — NOT because server-side autofill runs: it needs Canva
 * Enterprise brand templates this account doesn't have, and the live build is
 * the Claude+MCP runner (HANDOFF-MODULES.md §4).
 */
// Read off the master 2026-09-16, page by page. The shape is much simpler than
// the first draft assumed, and two slots it assumed DO NOT EXIST:
//   page 1 (cover) — TITLE ONLY. There is no hook line and no photo frame.
//   pages 2-5      — title + ONE paragraph. No bullets anywhere in this master.
//   page 6 (CTA)   — TITLE ONLY. There is no punchline slot, so the whole CTA
//                    has to fit in the title ("DM THE WORD AUDIT").
// Every page also carries fixed furniture the post never changes: brand name
// and hashtag in the header, handle and year in the footer.
export const YEDINO_FIELDS = [
  'cover_title',
  'slide_2_heading',
  'slide_2_intro',
  'slide_3_heading',
  'slide_3_intro',
  'slide_4_heading',
  'slide_4_intro',
  'slide_5_heading',
  'slide_5_intro',
  'cta_keyword',
] as const

/**
 * Per-post accent colour (docs/YEDINO-STYLE.md §12).
 *
 * Read off the real master 2026-09-14: the accent is NOT the text colour. The
 * body text is BLACK and sits on an accent-coloured HIGHLIGHT block, and the
 * same accent draws the dashed arrow. So the contrast test is accent-vs-BLACK,
 * not accent-vs-white — which is the opposite of what the first pass assumed
 * and rules out every dark accent.
 *
 * Palette is blue / white / yellow (Igor 2026-09-14). Measured against black:
 * every entry below clears 4.5:1 at any size. Brand-500 #2563EB is deliberately
 * ABSENT — it measures 4.06:1 against black, which is large-text-only and looks
 * heavy under a 32pt paragraph. The brand's blue lives in the lighter tints
 * here instead.
 *
 * Keyed by content pillar so the choice is deterministic and carries meaning —
 * the reader learns the colour before reading the heading — instead of being
 * picked by feel. Pillar strings mirror `clinics.content_pillars` exactly for
 * the yedino row; change one and you must change the other.
 */
export const YEDINO_ACCENTS: ReadonlyArray<{
  pillar: string
  hex: string
  label: string
  /** Measured contrast against the black body text that sits on it. */
  onBlack: number
}> = [
  { pillar: 'Why growing a brand matters', hex: '#38BDF8', label: 'sky', onBlack: 9.8 },
  {
    pillar: 'What doing it yourself actually costs',
    hex: '#FBBF24',
    label: 'yellow',
    onBlack: 12.58,
  },
  { pillar: 'Proof and numbers', hex: '#0EA5E9', label: 'deep sky', onBlack: 7.58 },
  { pillar: 'Objections doctors actually raise', hex: '#FFFFFF', label: 'white', onBlack: 21 },
  { pillar: 'How the operation runs', hex: '#93C5FD', label: 'pale blue', onBlack: 11.65 },
]

/** Accent for a post's pillar. Unknown/missing pillar → sky. */
export function yedinoAccentFor(pillar: string | null | undefined): string {
  const n = (pillar ?? '').trim().toLowerCase()
  return YEDINO_ACCENTS.find((a) => a.pillar.toLowerCase() === n)?.hex ?? '#38BDF8'
}

/**
 * LOCKED TYPE STANDARD for the Yedino master, read off the design itself
 * (Igor 2026-09-14: "шрифт соблюдал тот же, как правило 32 для базы, а
 * заглавие шрифт не менял размер").
 *
 * Both sizes are FIXED. Nothing resizes type per slide — the copy adapts to
 * the box, never the other way round. Same law as the HWC masters' 46/50.
 */
export const YEDINO_TYPE = {
  /** Body paragraph, as set in the master. */
  bodyPt: 32,
  /** Display title — never resized; the copy is cut instead. */
  titleFixed: true,
  /** Measured off page 3: ~28 characters per line at 32pt, 5 lines of room. */
  bodyCharsPerLine: 28,
  bodyMaxLines: 5,
  /** Title wraps at ~10 characters. */
  titleCharsPerLine: 10,
  /** Body pages share the box with a paragraph — 3 lines, ~26 chars. */
  titleMaxLines: 3,
  bodyTitleMaxChars: 26,
  /**
   * Cover and CTA are title-only pages, so their title box is taller and
   * takes more: the master's own read "BRANDING IS MORE THAN JUST LOOKS" (32)
   * and "DON'T FORGET TO SAVE THIS POST" (30).
   */
  soloTitleMaxChars: 32,
  soloTitleMaxLines: 5,
} as const

/**
 * False while the Yedino master has no Canva design id. Compose MUST check
 * this: composing with an empty id would either fail deep inside the runner or
 * — worse, if anything ever adds a fallback — build an agency post in a
 * clinic's look.
 */
export function yedinoMasterIsReady(): boolean {
  return (
    (STYLE_TEMPLATES.find((s) => s.id === YEDINO_STYLE_ID)?.canvaDesignId ?? '').trim()
      .length > 0
  )
}

/** Every style that has no master built yet — compose refuses these. */
export function styleIsComposable(raw: number | null | undefined): boolean {
  return getStyleTemplate(raw).canvaDesignId.trim().length > 0
}
