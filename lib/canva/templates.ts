// Per-category Canva brand-template mapping.
//
// Locked to the spec in
//   ~/Documents/Code Projects/Hawaii Wellness Clinic/My Bots & ALL Projects/docs/projects/canva-posts.md
// section "КАРТЫ ШАБЛОНОВ".
//
// Only ED + Peptides have ready masters as of 2026-06-10. Mental Health,
// Pain & Joint, Weight Loss masters are an open task (must be built
// manually in Canva UI — 10-slide layout: cover + analogy + 6 body +
// CTA-stack + category label). When they're ready, plug their IDs here.
//
// Brand Kit: kAG87QCkJl0 (Hawaii Wellness Clinic team workspace).

export interface HwcBrandTemplate {
  /** Canva design ID for the master. */
  id: string
  /** Human-readable label for logs / admin UI. */
  label: string
  /**
   * Whether the cover uses a full-bleed photo (ED) or a brand
   * gradient with text only (Peptides). photoFiller logic skips the
   * cover_photo asset for gradient covers.
   */
  coverHasPhoto: boolean
  /** Number of body slides the master holds (post n=2..n=2+bodyCount-1). */
  bodyCount: number
  /** Page IDs in slide order — used for export bookkeeping. */
  pageIds: string[]
  /**
   * Map of slot → element ID. Used by perform-editing-operations to
   * target updates without scanning fills[] from the transaction.
   * Names match the spec's element-ID list.
   */
  elements: {
    cover_hook: string
    cover_title?: string
    cover_series_pill?: string
    cover_photo?: string
    body_backgrounds: string[]   // length = bodyCount, one per body slide
    cta_keyword: string
    cta_punchline?: string
  }
}

export const HWC_BRAND_KIT_ID = 'kAG87QCkJl0'

// Template A — ED / men's health (Wellness & Vitality category).
const TEMPLATE_ED: HwcBrandTemplate = {
  id: 'DAHK2poX3PY',
  label: 'ED / Men\'s Health (full-bleed photo cover)',
  coverHasPhoto: true,
  bodyCount: 7,
  pageIds: [
    'PBLpQwwqcRRCN8bw',
    'PBWhVZPMKK6X0zhg',
    'PB24CKPWW7LkysR0',
    'PBcgthG7L4Ck5Rw7',
    'PBrwvGHzpHV8cXRP',
    'PBmyLSmHVgGK4sw9',
    'PBZ3wn9Sd6Z04yfF',
    'PBH9DftLhXxbt2p3',
  ],
  elements: {
    cover_photo: 'PBLpQwwqcRRCN8bw-LBzDwQlxtKLvBWBP-a',
    cover_hook: 'PBLpQwwqcRRCN8bw-LBPpKNFNClQ93NlV',
    cover_series_pill: 'PBLpQwwqcRRCN8bw-LB72KBdq4JHzgGCN',
    cover_title: 'PBLpQwwqcRRCN8bw-LB0mlXVXxlt20qkK',
    body_backgrounds: [
      'PBWhVZPMKK6X0zhg-LBtL3hqZHcx5gKYD-a',
      'PB24CKPWW7LkysR0-LBFStxPLHCg0fymH',
      'PBcgthG7L4Ck5Rw7-LBCd9Lr8yWHlGkZk',
      'PBrwvGHzpHV8cXRP-LB0F6MPc07W3Q7wd',
      'PBmyLSmHVgGK4sw9-LBSwb9KgnPccl7yF',
      'PBZ3wn9Sd6Z04yfF-LBwdtdjmtJh7tKTm',  // oversized bleed
      'PBH9DftLhXxbt2p3-LBMn7s4h5BCmT7kR',
    ],
    cta_keyword: 'PBH9DftLhXxbt2p3-LBbt47qGK1MDpK4k',
  },
}

// Template B — Peptides (Wellness & Vitality category).
// Cover is a brand GRADIENT — do NOT inject a photo for n=1.
const TEMPLATE_PEPTIDES: HwcBrandTemplate = {
  id: 'DAHK2t13oEI',
  label: 'Peptides (gradient cover, body has full-bleed photos)',
  coverHasPhoto: false,
  bodyCount: 7,
  pageIds: [
    'PBtJHFT52TXcqdjQ',
    'PBxlPVxhvlxnPxWg',
    'PB5wbJ7p23cbsY0G',
    'PBK36vc8X9VB6fCn',
    'PBf2KVtNwd6cB8xs',
    'PBFpDwGbZtrlLmdB',
    'PBtmYqGG3SKGMLqV',
    'PBFQ5F79jyF1qFn7',
  ],
  elements: {
    // Cover gradient placeholder kept for reference; do not replace it.
    cover_hook: 'PBtJHFT52TXcqdjQ-LBBLplvHZ0sT6RdP',
    cover_title: 'PBtJHFT52TXcqdjQ-LBWXdSf5B2YJLhhx',
    cover_series_pill: 'PBtJHFT52TXcqdjQ-LB8Y40mnD3QNVwzY',
    body_backgrounds: [
      'PBxlPVxhvlxnPxWg-LB4JhSYtYblg4QFF',
      'PB5wbJ7p23cbsY0G-LBK8mDmWGf2wdR2S',
      'PBK36vc8X9VB6fCn-LBMCF3kYSsY0Zc0y',
      'PBf2KVtNwd6cB8xs-LBql2HqTMmlTGnKB',
      'PBFpDwGbZtrlLmdB-LBkMn9GgSGptfymK',  // oversized bleed
      'PBtmYqGG3SKGMLqV-LBxsHCZCbKCnhCgH',
      'PBFQ5F79jyF1qFn7-LBYTyf2N2kkh35kT',
    ],
    cta_keyword: 'PBFQ5F79jyF1qFn7-LBr30754TBDTw6xv',
    cta_punchline: 'PBFQ5F79jyF1qFn7-LBM751s0C2sR4R8x',
  },
}

// Category → template. Only map categories that have a real master.
// DO NOT fall back to a wrong-category master — this causes silent text
// injection failures and wrong branding (proven 2026-06-18 with SGB post).
// Mental Health / Pain & Joint / Weight Loss masters are not built yet.
// When they're ready, add their IDs here.
const CATEGORY_MAP: Record<string, HwcBrandTemplate> = {
  'wellness_vitality': TEMPLATE_PEPTIDES,
  // Mental Health master → NOT CREATED. Create in Canva UI first, then add here.
  // Pain & Joint master → NOT CREATED. Create in Canva UI first, then add here.
  // Weight Loss master  → NOT CREATED. Create in Canva UI first, then add here.
}

/**
 * Pick the brand template for a post. Topic keywords win over category
 * — "erectile dysfunction" / "men's health" routes to ED master
 * regardless of slug. Returns null when nothing fits, so the caller
 * can fall back to queue-only.
 */
export function pickBrandTemplate(params: {
  categorySlug: string | null
  topic: string | null
}): HwcBrandTemplate | null {
  const topic = (params.topic ?? '').toLowerCase()
  if (
    topic.includes('erectile') ||
    topic.includes(' ed ') ||
    topic.startsWith('ed ') ||
    topic.includes("men's") ||
    topic.includes('mens health')
  ) {
    return TEMPLATE_ED
  }
  if (topic.includes('peptide') || topic.includes('copper')) {
    return TEMPLATE_PEPTIDES
  }
  if (params.categorySlug) {
    const cat = params.categorySlug.toLowerCase().replace(/[\s-]+/g, '_')
    if (CATEGORY_MAP[cat]) return CATEGORY_MAP[cat]
  }
  return null
}

export { TEMPLATE_ED, TEMPLATE_PEPTIDES }
