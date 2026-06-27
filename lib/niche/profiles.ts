// Niche profile registry — single source of truth for per-niche configuration.
//
// Every clinic has a `niche` string in the DB. The profile it resolves to
// controls how Writer, Splitter, and Compliance behave for that clinic.
//
// Two shipped profiles:
//   'regenerative_medicine' — HWC / regenmed clinics. ManyChat keyword CTA.
//   'aesthetics'            — Botox / filler / cosmetic injector clinics. Booking CTA.
//
// Unknown niche → fallback to regenerative_medicine (zero breakage for
// existing HWC clinics that have no niche set).

export type CtaMode = 'manychat' | 'booking'

export interface NicheProfile {
  id: string
  /** Human-readable label used in prompts: "regenerative medicine" | "medical aesthetics" */
  label: string
  /**
   * First paragraph of SYSTEM_PROMPT_BASE.
   * Defines who is writing and for whom. Replaces the hardcoded
   * "You write scripts for a regenerative medicine doctor…" opening.
   */
  writerPersona: string
  /** Controls how the CTA slide is built. */
  ctaMode: CtaMode
  /**
   * Full KEYWORD section for the writer's SYSTEM_PROMPT_POSTS.
   * Only populated when ctaMode === 'manychat'.
   */
  manychatKeywordsBlock?: string
  /**
   * Compliance facts block injected into the writer's COMPLIANCE BASELINE
   * and into the compliance agent's SYSTEM_PROMPT.
   * Contains FDA approval dates, investigational-drug notices, and hedging rules
   * specific to this niche.
   */
  complianceFacts: string
  /**
   * APPROVED TREATMENTS carve-out for the compliance gate.
   * Prevents the LLM from flagging legitimately cleared treatments as R-FDA-01.
   * Only needed for niches with in-house approved treatments (regenmed).
   */
  complianceCarveOut?: string
  /**
   * R-EXOSOME-01 or other niche-specific hard rules for the compliance gate.
   * Appended after the general rules.
   */
  complianceNicheRules?: string
  /**
   * Optional gold-standard tone reference for the writer (regenmed only).
   * Points to canonical posts the Writer can use as examples.
   */
  writerGoldStandardRef?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile: regenerative_medicine
// Source of truth for the HWC / regenmed clinics. All strings are copied
// verbatim from the prior hardcoded writer.ts / compliance.ts to guarantee
// zero regression for Dr. Shawn.
// ─────────────────────────────────────────────────────────────────────────────

const REGENMED_MANYCHAT_KEYWORDS = `KEYWORD must be chosen from the ManyChat trigger list below — these are the ONLY valid keywords. Pick the single best fit for the script's category and topic. Never invent a keyword outside this list.

  🧠 Mental Health:
    TMS, Ketamine, SGB, Spravato, Reset, Clarity, Relief, Depression, Anxiety, PTSD, Trauma, Mood

  🦴 Pain & Joint:
    PRP, A2M, Biologics, Biologic, Regenerative, Cartilage, Arthritis, Joint, Shots, Mounjaro, GLP, Transform

  ✨ Wellness & Vitality:
    IV, NAD, NAD+, Peptide, Hormones, Testosterone, Estrogen, Thyroid, Infusion, Drip, Boost, Energy

  ⚖️ Medical Weight Loss:
    Semaglutide, Tirzepatide, Retatrutide, Ozempic, Mounjaro, GLP-1, Injection, Program, Results, Appetite, Metabolism

  Selection logic: identify which category the script belongs to → pick the word that most specifically names the treatment or mechanism covered (e.g. a TMS script → TMS, not Mood; a peptides script → Peptide, not Boost). If topic matches the 24-post deterministic map in lib/seeds/cta-keywords.ts, that exact keyword overrides this list.`

const REGENMED_COMPLIANCE_FACTS = `  • NEVER claim a therapy "treats / cures / reverses / regenerates / restores" anything. Use "supports", "may help", "studies report", "pilot data shows".
  • NEVER state "FDA-approved" or "FDA-cleared" unless literally true for that exact product. Verified dates:
      TMS — depression 2008, OCD 2018, smoking 2020, anxious depression 2021 (NOT 2020)
      Spravato — TRD Mar 2019, MDD-w-suicidal-ideation 2020, monotherapy Jan 2025
      SELECT trial — 17,604 adults with ESTABLISHED cardiovascular disease (do not drop "established")
      Retatrutide — investigational, NOT FDA-approved (Phase 2 NEJM 2023; Phase 3 TRIUMPH Dec 2025)
      Peptides (BPC-157, TB-500, CJC-1295/Ipamorelin) — NOT FDA-approved
      Exosomes — NEVER offer as a service (FDA: no approved exosome products)
  • ALWAYS label evidence stage: "Phase 2", "pilot studies", "preclinical", "investigational, not FDA-approved".
  • NEVER invent statistics. No made-up percentages, no fabricated response rates, no invented study outcomes. If a number isn't in the verified facts above, don't write it. Use qualitative language instead: "many patients", "studies show improvement", "clinical results are promising".
  • ALWAYS produce a sources array with each non-trivial factual claim cited. Sources go in a separate "sources" field — NEVER inside the script or caption.
  • For Mental Health bucket captions, ALWAYS end the caption with: "If you or someone you know is struggling, call or text 988 — the Suicide & Crisis Lifeline."`

const REGENMED_PROFILE: NicheProfile = {
  id: 'regenerative_medicine',
  label: 'regenerative medicine',
  writerPersona:
    'You write scripts for a regenerative medicine doctor speaking to camera. The audience is curious ADULT PATIENTS — people considering a treatment or trying to understand what\'s happening with their body. NOT colleagues. NOT other doctors. NOT a peer-reviewed audience.',
  ctaMode: 'manychat',
  manychatKeywordsBlock: REGENMED_MANYCHAT_KEYWORDS,
  complianceFacts: REGENMED_COMPLIANCE_FACTS,
  complianceCarveOut: `APPROVED TREATMENTS CARVE-OUT (do NOT flag these as non-FDA-approved):
  Hawaii Wellness Clinic has received full government approval and regulatory clearance for its biologic and stem cell treatments. When the script mentions "biologics", "stem cells", "stem cell therapy", "biologic therapy", or similar — do NOT apply R-FDA-01. These are cleared services. Only flag if the wording makes a disease-cure claim covered by R-CLAIM-01.`,
  complianceNicheRules: `  • R-EXOSOME-01: Never offer exosomes as a service. Discussing the science is fine; presenting as offered = REMOVE.`,
  writerGoldStandardRef:
    'Use the canonical examples in docs/content-plan-2026-06.md §5 (posts 01 Ketamine, 07 Painkillers, 11 Semaglutide, 18 ED) as gold-standard tone references when relevant — these are source-checked and pass compliance v2.1.',
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile: aesthetics
// Botox / dermal filler / cosmetic injector clinics. Booking-style CTA,
// no ManyChat keyword mechanic. Aesthetics-specific FDA/FTC compliance.
// ─────────────────────────────────────────────────────────────────────────────

const AESTHETICS_COMPLIANCE_FACTS = `  • NEVER claim a treatment "cures / eliminates / permanently removes" wrinkles, skin conditions, or signs of aging. Use "may reduce the appearance of", "can soften", "results typically last X months".
  • Botox / Dysport (onabotulinumtoxinA / abobotulinumtoxinA): FDA-approved for specific cosmetic indications only (glabellar lines, crow's feet, forehead lines — approval varies by product and exact indication). ONLY claim FDA-approved for the precise indication if you are certain. For off-label uses (neck, jaw, brow, migraine off-label etc.) use "used off-label" or simply omit "FDA-approved".
  • Dermal fillers (Juvederm, Restylane, etc.): FDA-cleared devices for specific soft-tissue augmentation. They are NOT FDA-approved drugs. NEVER say they "treat" a condition. Use "may add volume", "can soften the appearance of". Results are temporary — NEVER claim permanent.
  • Skincare, laser, and energy-based treatments: these do NOT carry broad FDA approval for cosmetic anti-aging claims. Use "clinically studied", "shown to improve skin texture", "may reduce the appearance of".
  • ALWAYS hedge results: "results vary", "individual results may differ", "typically lasts 3–6 months", "multiple sessions may be needed".
  • ALWAYS include at least one hedging phrase per therapeutic claim: "may help", "can support", "many patients", "studies suggest", "talk to your provider".
  • NEVER invent statistics or response rates. Use qualitative language: "many patients notice improvement", "results are visible within days for most".
  • No disease-cure claims. For acne: "may improve the appearance of acne" not "treats acne".`

const AESTHETICS_PROFILE: NicheProfile = {
  id: 'aesthetics',
  label: 'medical aesthetics',
  writerPersona:
    'You write scripts for a medical aesthetics and cosmetic injector doctor speaking to camera. The audience is curious adults — people considering or curious about Botox, dermal fillers, skin resurfacing, chemical peels, or anti-aging treatments. NOT colleagues. NOT other injectors. NOT a peer-reviewed audience.',
  ctaMode: 'booking',
  complianceFacts: AESTHETICS_COMPLIANCE_FACTS,
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry + lookup
// ─────────────────────────────────────────────────────────────────────────────

const PROFILES: Record<string, NicheProfile> = {
  regenerative_medicine: REGENMED_PROFILE,
  aesthetics: AESTHETICS_PROFILE,
}

/**
 * Resolve a niche string to its NicheProfile.
 * Normalises (lower/trim), matches by id.
 * Unknown or null niche → fallback to regenerative_medicine (HWC default).
 */
export function getNicheProfile(niche: string | null | undefined): NicheProfile {
  if (!niche) return PROFILES.regenerative_medicine
  const normalized = niche.trim().toLowerCase()
  return PROFILES[normalized] ?? PROFILES.regenerative_medicine
}
