// Shapes for the in-house slide renderer.
//
// The whole point of this module (Igor 2026-08-13): a slide has ONE shape
// vocabulary shared by every style, and a style is only a skin on top. The
// Canva path had the opposite arrangement — five hand-drawn masters with
// different page counts, panel sizes and cover rules — which is where the
// per-style special cases in the compose-runner skill came from.

export type SlideShape = 'cover' | 'prose' | 'list' | 'cta'

export interface RenderSlide {
  /** 1-based page number; 1 is always the cover, the CTA is always last. */
  page: number
  shape: SlideShape
  /** Eyebrow / chip. Cover: pillar + topic. Body: nothing. */
  chip?: string | null
  /** Cover title, or the body slide's heading. */
  heading?: string | null
  /** Prose body (body slides) or the hook (cover). */
  body?: string | null
  /** List items, already stripped of their markers. */
  items?: string[]
  /** The takeaway — set apart and bold. Never merged into `body`. */
  takeaway?: string | null
  /** CTA lines, in render order. */
  ctaKeyword?: string | null
  ctaLines?: string[]
  /** Resolved background photo, if this slide gets one. */
  photoUrl?: string | null
}

/**
 * A style = a token set. Everything the HTML builder needs to draw any shape.
 * Adding a style means adding one of these, never a new code path.
 */
export interface Skin {
  id: number
  key: string
  name: string
  /** Page background behind everything (also shows through where no photo). */
  background: string
  /** The translucent content panel, as a CSS background value. */
  panel: string
  panelText: string
  /** Heading font stack + style. */
  headingFamily: string
  headingStyle: 'normal' | 'italic'
  headingWeight: number
  headingTransform: 'uppercase' | 'none'
  headingSize: number
  bodyFamily: string
  bodyWeight: number
  bodySize: number
  /** Hairline divider colour (already includes alpha). */
  rule: string
  /** Accent used for chips, markers and the CTA keyword. */
  accent: string
  /** Panel corner treatment. */
  radius: number
  /** Does this style's cover carry a full-bleed photo, or a branded surface? */
  coverPhoto: boolean
  /** Diagonal panel edge (Style 1/3 look) vs straight/curved. */
  panelEdge: 'diagonal' | 'straight' | 'curve'
}

export const CANVAS = { width: 1080, height: 1350 } as const
