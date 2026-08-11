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
}

export const STYLE_TEMPLATES: StyleTemplate[] = [
  {
    id: 1,
    key: 'style1',
    name: 'Style 1',
    description: 'Diagonal translucent panels over a full-bleed photo — bold, editorial.',
    canvaDesignId: 'DAHRSR-KWdA',
    previewImage: '/style-previews/style1.png',
  },
  {
    id: 2,
    key: 'style2',
    name: 'Style 2',
    description: 'Rounded teal panels — checklist ✓ + numbered path ①②③, soft insets.',
    canvaDesignId: 'DAHQnsEktf0',
    previewImage: '/style-previews/style2.png',
  },
  {
    id: 3,
    key: 'style3',
    name: 'Style 3',
    description: 'Editorial diagonal — dark render/photo covers with a statement + one line.',
    canvaDesignId: 'DAHRSiuJEHQ',
    previewImage: '/style-previews/style3.png',
  },
  {
    id: 4,
    key: 'style4',
    name: 'Style 4',
    description: 'Curved teal/purple panels — clean, clinical, medical-context imagery.',
    canvaDesignId: 'DAHQn_1_j2s',
    previewImage: '/style-previews/style4.png',
  },
  {
    id: 5,
    key: 'aesthetic',
    name: 'Aesthetic',
    description: 'Full-bleed photo cover, magazine feel — kept separately for Made.',
    canvaDesignId: 'DAHMHS1wLls',
    previewImage: '/style-previews/aesthetic.png',
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
