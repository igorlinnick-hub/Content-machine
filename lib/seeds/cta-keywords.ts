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
} as const

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
