// Deterministic post-slug → CTA keyword map for the 24-post HWC content
// plan (June 2026). Source of truth: docs/content-plan-2026-06.md §3.
//
// The writer uses suggestCtaKeyword() before falling back to LLM
// generation. Keeping this in code (not just markdown) prevents
// drift — the test suite can assert that every plan post resolves
// to a single, stable keyword.

// ── ManyChat trigger lists (source of truth for Writer keyword selection) ──
// These are the ONLY valid CTA keywords. Words are ALL-CAPS in the CTA stack.
// Writer picks the best fit for the script category; slug map below overrides.
export const MANYCHAT_CTA_CATEGORIES = {
  mental_health: [
    'TMS', 'Ketamine', 'SGB', 'Spravato', 'Reset', 'Clarity', 'Relief',
    'Depression', 'Anxiety', 'PTSD', 'Trauma', 'Mood',
  ],
  pain_joint: [
    'PRP', 'A2M', 'Biologics', 'Biologic', 'Regenerative', 'Cartilage',
    'Arthritis', 'Joint', 'Shots', 'Mounjaro', 'GLP', 'Transform',
  ],
  wellness_vitality: [
    'IV', 'NAD', 'NAD+', 'Peptide', 'Hormones', 'Testosterone', 'Estrogen',
    'Thyroid', 'Infusion', 'Drip', 'Boost', 'Energy',
  ],
  weight_loss: [
    'Semaglutide', 'Tirzepatide', 'Retatrutide', 'Ozempic', 'Mounjaro',
    'GLP-1', 'Injection', 'Program', 'Results', 'Appetite', 'Metabolism',
  ],
  // HWC's 5th pillar (Igor 2026-08-31) — the /aesthetics/ page of
  // hawaiiwellnessclinic.com: Botox, Microneedling, Lip Filler, Sculptra,
  // Stem Cell Aesthetics, peptide-supported aesthetic wellness.
  // Deliberately no PRP / STEMCELL here: both already read as joint work at
  // HWC, and a face post must not land in the joint flow. Every word below is
  // unique across the five pillars.
  aesthetics: [
    'BOTOX', 'FILLER', 'LIPS', 'SCULPTRA', 'MICRO', 'COLLAGEN',
    'GLOW', 'SKIN', 'RENEW', 'PREVENTION', 'SMOOTH', 'REFRESH',
  ],
} as const

// ── Aesthetics niche (Dr. Made) keyword pool ──────────────────────────────
// Cosmetic-injector clinics: Botox / filler / skin / anti-aging. Used by the
// planner when the clinic's niche is aesthetics — instead of the regenmed
// pillar lists above (which would assign nonsensical TMS/PRP-style keywords).
export const AESTHETICS_CTA_KEYWORDS = [
  'GLOW', 'BOTOX', 'FILLER', 'LIPS', 'RENEW', 'SKIN',
  'YOUTH', 'PRP', 'STEMCELL', 'BEAUTY', 'ALOHA', 'MICRO',
] as const

// Resolve the valid keyword pool + a prompt-ready block for a clinic's niche.
// regenerative_medicine (default / HWC) → the four pillar lists.
// aesthetics → the flat cosmetic list above.
export function keywordPoolForNiche(niche: string | null | undefined): {
  keywords: string[]
  promptBlock: string
} {
  const n = (niche ?? '').trim().toLowerCase()
  if (n.includes('aesthetic')) {
    return {
      keywords: [...AESTHETICS_CTA_KEYWORDS],
      promptBlock: `Aesthetics keywords: ${AESTHETICS_CTA_KEYWORDS.join(', ')}`,
    }
  }
  return {
    keywords: [
      ...MANYCHAT_CTA_CATEGORIES.mental_health,
      ...MANYCHAT_CTA_CATEGORIES.pain_joint,
      ...MANYCHAT_CTA_CATEGORIES.wellness_vitality,
      ...MANYCHAT_CTA_CATEGORIES.weight_loss,
      ...MANYCHAT_CTA_CATEGORIES.aesthetics,
    ],
    promptBlock: [
      `Mental Health pillar: ${MANYCHAT_CTA_CATEGORIES.mental_health.join(', ')}`,
      `Pain & Joint pillar: ${MANYCHAT_CTA_CATEGORIES.pain_joint.join(', ')}`,
      `Wellness & Vitality pillar: ${MANYCHAT_CTA_CATEGORIES.wellness_vitality.join(', ')}`,
      `Weight Loss pillar: ${MANYCHAT_CTA_CATEGORIES.weight_loss.join(', ')}`,
      `Aesthetics pillar: ${MANYCHAT_CTA_CATEGORIES.aesthetics.join(', ')}`,
    ].join('\n'),
  }
}

export const CTA_KEYWORD_BY_TOPIC_SLUG: Record<string, string> = {
  'ketamine-depression': 'RESET',
  'antidepressant-failure': 'MECHANISM',
  'standard-treatment-ceiling': 'SIGNS',
  'hormones-after-40': 'HORMONES',
  'testosterone-not-muscle': 'TESTOSTERONE',
  'nad-cellular-currency': 'NAD',
  'painkillers-dont-heal-joints': 'JOINT',
  'prp-blood-medicine': 'PRP',
  'shockwave-pain': 'SHOCKWAVE',
  'diets-fail-biology': 'METABOLISM',
  'semaglutide-not-scale': 'SEMAGLUTIDE',
  'glp1-30-days': 'GLP1',
  'sgb-ptsd': 'SGB',
  'anxiety-not-head': 'ANXIETY',
  'tms-magnetic-fields': 'TMS',
  'peptides-what-they-are': 'PEPTIDE',
  'iv-drips-marketing': 'IV',
  'erectile-dysfunction': 'VITALITY',
  'spravato-not-ketamine': 'SPRAVATO',
  'suicidal-thoughts': 'SUPPORT',
  'talk-someone-not-enough': 'CLARITY',
  'a2m-cartilage': 'A2M',
  'retatrutide-next-step': 'RETATRUTIDE',
  'standard-blood-panel-gaps': 'PROGRAM',
}

// ── Keyword enforcement (Igor 2026-08-31) ────────────────────────────────
// ManyChat only answers words that exist as triggers. The Made SPF post
// shipped with `Comment "PREVENTION"` — a word the model invented, absent from
// every list — so the CTA on the slide was dead on arrival. Nothing outside
// these pools may reach a slide: the splitter resolves through here.
// (PREVENTION is now a real HWC aesthetics trigger — but still NOT in Made's
// pool, so the same word on a Made post is still dropped.)

// Used only when no candidate and no topic word resolves. Both are real
// triggers, deliberately the broadest ones in their pool.
export const DEFAULT_CTA_KEYWORD_BY_NICHE: Record<string, string> = {
  aesthetics: 'ALOHA',
  regenerative_medicine: 'REGENERATIVE',
}

export function isValidCtaKeyword(
  keyword: string | null | undefined,
  niche: string | null | undefined
): boolean {
  if (!keyword?.trim()) return false
  const needle = keyword.trim().toUpperCase()
  return keywordPoolForNiche(niche).keywords.some(
    (k) => k.toUpperCase() === needle
  )
}

/**
 * Resolve the CTA keyword to one the ManyChat bot actually knows.
 *
 * Candidates are tried in the caller's priority order (plan-assigned first,
 * then whatever the model produced); the first VALID one wins. If none is
 * valid, a pool word named in the topic is used, and only then the niche
 * default — the result is always a real trigger, never an invention.
 */
export function resolveCtaKeyword(
  candidates: Array<string | null | undefined>,
  opts: { niche?: string | null; topic?: string | null } = {}
): string {
  const pool = keywordPoolForNiche(opts.niche).keywords
  for (const c of candidates) {
    if (isValidCtaKeyword(c, opts.niche)) return c!.trim().toUpperCase()
  }
  const topic = (opts.topic ?? '').toLowerCase()
  if (topic) {
    // Longest first so "GLP-1" wins over "GLP" and "NAD+" over "NAD".
    const byLength = [...pool].sort((a, b) => b.length - a.length)
    const hit = byLength.find((k) => topic.includes(k.toLowerCase()))
    if (hit) return hit.toUpperCase()
  }
  const n = (opts.niche ?? '').trim().toLowerCase()
  const fallback = n.includes('aesthetic')
    ? DEFAULT_CTA_KEYWORD_BY_NICHE.aesthetics
    : DEFAULT_CTA_KEYWORD_BY_NICHE.regenerative_medicine
  return fallback.toUpperCase()
}

export function suggestCtaKeyword(topicSlug: string | null | undefined): string | null {
  if (!topicSlug) return null
  return CTA_KEYWORD_BY_TOPIC_SLUG[topicSlug.toLowerCase().trim()] ?? null
}

// Mental-health-acute substring triggers — when ANY of these appear in
// the topic or hook string, the writer drops the analogy slide AND
// strips the CTA stack to "Comment + crisis_line" only. Used in both
// the writer (via writer.ts) and the splitter (via slides.ts) to keep
// the stripped template consistent end-to-end.
export const MENTAL_HEALTH_ACUTE_TRIGGERS = [
  'suicid',           // suicide, suicidal
  'self-harm',
  'self harm',
  'acute ideation',
  'active ideation',
  '988',
  'lifeline',
  'crisis intervention',
] as const

export function isMentalHealthAcute(topic: string, hook?: string | null): boolean {
  const blob = `${topic ?? ''} ${hook ?? ''}`.toLowerCase()
  return MENTAL_HEALTH_ACUTE_TRIGGERS.some((t) => blob.includes(t))
}

// Category bucket mapping for the 4 HWC content-plan buckets.
// Used by the captioner to decide if the 988 line is mandatory.
export const CATEGORY_BUCKETS = {
  mental_health: 'Mental Health',
  pain_joint: 'Pain & Joint',
  wellness_vitality: 'Wellness & Vitality',
  weight_loss: 'Weight Loss',
} as const

export type CategoryBucket = keyof typeof CATEGORY_BUCKETS

export function requires988Line(bucket: CategoryBucket | string | null): boolean {
  return bucket === 'mental_health' || bucket === 'Mental Health'
}

export const CRISIS_LINE_988 =
  'If you or someone you know is struggling, call or text 988 — the Suicide & Crisis Lifeline.'
