// Niche profile registry — single source of truth for per-niche configuration.
//
// Every clinic has a `niche` string in the DB. The profile it resolves to
// controls how Writer, Splitter, and Compliance behave for that clinic.
//
// Shipped profiles:
//   'regenerative_medicine' — HWC / regenmed clinics. ManyChat keyword CTA.
//   'aesthetics'            — Botox / filler / cosmetic injector clinics. ManyChat keyword CTA.
//   'yedino'                — Yedino Systems itself (@yedino.systems). B2B: the
//                             agency selling a content operation to clinic owners.
//                             Not a medical advertiser — see YEDINO_COMPLIANCE_FACTS.
//
// Unknown niche → fallback to regenerative_medicine (zero breakage for
// existing HWC clinics that have no niche set).

import {
  AESTHETICS_CTA_KEYWORDS,
  MANYCHAT_CTA_CATEGORIES,
} from '@/lib/seeds/cta-keywords'

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
   * Hard per-slide text budget, injected right after the persona. Exists for
   * niches whose Canva master carries LITTLE text and cannot grow to fit:
   * the writer must land inside the budget, because nothing downstream
   * shrinks the font (POST-CRAFT §4a / YEDINO-STYLE §8b both forbid it).
   */
  writerBudget?: string
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

  💎 Aesthetics (Botox, Microneedling, Lip Filler, Sculptra, Stem Cell Aesthetics):
    ${MANYCHAT_CTA_CATEGORIES.aesthetics.join(', ')}

  Selection logic: identify which category the script belongs to → pick the word that most specifically names the treatment or mechanism covered (e.g. a TMS script → TMS, not Mood; a peptides script → Peptide, not Boost; a Botox script → BOTOX, not SMOOTH; lip work → LIPS; microneedling → MICRO; Sculptra / collagen stimulation → SCULPTRA or COLLAGEN; stem cell facial or skin renewal → RENEW; preventative / «baby Botox» / starting early → PREVENTION; broad skin-quality or glow-up posts → SKIN, GLOW, or REFRESH). Aesthetics words are for FACE/SKIN posts only — never use them for joint, weight, or mental-health scripts, and never use PRP/Regenerative for a facial script (those route to the joint flow). If topic matches the 24-post deterministic map in lib/seeds/cta-keywords.ts, that exact keyword overrides this list.`

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
// Botox / dermal filler / cosmetic injector clinics. ManyChat keyword CTA
// (Dr. Made's ManyChat is configured with the aesthetics keyword pool).
// Aesthetics-specific FDA/FTC compliance.
// ─────────────────────────────────────────────────────────────────────────────

const AESTHETICS_COMPLIANCE_FACTS = `  • NEVER claim a treatment "cures / eliminates / permanently removes" wrinkles, skin conditions, or signs of aging. Use "may reduce the appearance of", "can soften", "results typically last X months".
  • Botox / Dysport (onabotulinumtoxinA / abobotulinumtoxinA): FDA-approved for specific cosmetic indications only (glabellar lines, crow's feet, forehead lines — approval varies by product and exact indication). ONLY claim FDA-approved for the precise indication if you are certain. For off-label uses (neck, jaw, brow, migraine off-label etc.) use "used off-label" or simply omit "FDA-approved".
  • Dermal fillers (Juvederm, Restylane, etc.): FDA-cleared devices for specific soft-tissue augmentation. They are NOT FDA-approved drugs. NEVER say they "treat" a condition. Use "may add volume", "can soften the appearance of". Results are temporary — NEVER claim permanent.
  • Skincare, laser, and energy-based treatments: these do NOT carry broad FDA approval for cosmetic anti-aging claims. Use "clinically studied", "shown to improve skin texture", "may reduce the appearance of".
  • ALWAYS hedge results: "results vary", "individual results may differ", "typically lasts 3–6 months", "multiple sessions may be needed".
  • ALWAYS include at least one hedging phrase per therapeutic claim: "may help", "can support", "many patients", "studies suggest", "talk to your provider".
  • NEVER invent statistics or response rates. Use qualitative language: "many patients notice improvement", "results are visible within days for most".
  • No disease-cure claims. For acne: "may improve the appearance of acne" not "treats acne".`

const AESTHETICS_MANYCHAT_KEYWORDS = `KEYWORD must be chosen from the ManyChat trigger list below — these are the ONLY valid keywords. Pick the single best fit for the script's topic. Never invent a keyword outside this list.

  ✨ Aesthetics:
    ${AESTHETICS_CTA_KEYWORDS.join(', ')}

  Selection logic: pick the word that most specifically names the treatment or theme covered (Botox script → BOTOX; lip work → LIPS or FILLER; skin resurfacing / peels → SKIN or GLOW; PRP microneedling → PRP or MICRO; regenerative / anti-aging → RENEW, YOUTH, or STEMCELL). Use BEAUTY or ALOHA for broader brand-tone posts. If the topic maps to a fixed keyword in lib/seeds/cta-keywords.ts, that exact keyword overrides this list.`

const AESTHETICS_PROFILE: NicheProfile = {
  id: 'aesthetics',
  label: 'medical aesthetics',
  writerPersona:
    'You write scripts for a medical aesthetics and cosmetic injector doctor speaking to camera. The audience is curious adults — people considering or curious about Botox, dermal fillers, skin resurfacing, chemical peels, or anti-aging treatments. NOT colleagues. NOT other injectors. NOT a peer-reviewed audience.',
  ctaMode: 'manychat',
  manychatKeywordsBlock: AESTHETICS_MANYCHAT_KEYWORDS,
  complianceFacts: AESTHETICS_COMPLIANCE_FACTS,
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile: yedino
// Yedino Systems — the AGENCY'S OWN account (@yedino.systems). Not a clinic:
// the audience is clinic owners and practice managers, and the product is a
// content operation, not a treatment.
//
// It rides the same machine as a clinic (scripts → carousel) because the shape
// of the work is identical; only the persona, the CTA pool, and the compliance
// surface differ. Its visual system is docs/YEDINO-STYLE.md.
// ─────────────────────────────────────────────────────────────────────────────

const YEDINO_MANYCHAT_KEYWORDS = `KEYWORD must be chosen from the Yedino DM trigger list below — these are the ONLY valid keywords. Pick the single best fit for the script's angle. Never invent a keyword outside this list.

  AUDIT      — the free 20-minute growth audit. The default, and the strongest.
  SYSTEM     — how the content operation is run end to end.
  POSTS      — what a month of finished content actually looks like.
  DMS        — the always-on DM answering.
  NUMBERS    — what gets reported, and how often.`

const YEDINO_COMPLIANCE_FACTS = `YEDINO IS NOT A MEDICAL ADVERTISER. It sells a content operation to clinics. The medical-claim rules that govern a clinic's own posts do not apply here, but FTC advertising rules do, and they are strict:

- NEVER make a medical claim of any kind — not about a treatment, an outcome, or a condition. Yedino does not treat anyone. If a script drifts into describing what a treatment does, that is out of scope and must be cut.
- NEVER promise business results as a guarantee. Volumes we control (how many videos get produced, how often we report) may be stated plainly. Anything downstream of the market — patients, bookings, revenue, reach — must be described as what the operation is aimed at, never as what the clinic will get.
- Any number presented as a result must be REAL and traceable to an actual client. No illustrative figures, no "typical" numbers, no composites. If it cannot be sourced, it does not go in the script.
- Testimonials and case studies describe the experience of that specific client, and must be disclosed as such. No implying a stated result is typical.
- Screenshots used as proof must be genuine and the client's identifying details removed. A generated or mocked-up proof image is prohibited outright (docs/YEDINO-STYLE.md §6).
- Never state or imply that Yedino is affiliated with, endorsed by, or acting on behalf of a clinic it does not work with.`

const YEDINO_PROFILE: NicheProfile = {
  id: 'yedino',
  label: 'content operations for medical clinics',
  writerPersona:
    'You write scripts for the founder of Yedino Systems. Yedino runs the content operation for medical practices: the practice films on a phone, Yedino does everything after that — editing, captions, publishing, boosting, and answering DMs. The audience is DOCTORS WHO OWN THEIR PRACTICE, in regenerative and longevity medicine: stem cell and regenerative therapies, bio-identical HRT, peptides, neuropathy, and the like. They are physicians, not patients and not marketers. They already suspect their marketing is not working and have no time to fix it. Write owner-to-owner about running the practice — why building their own name changes where patients come from, the objections they raise out loud, and concrete advice they can act on. NEVER teach medicine: they know more medicine than you do, and a post that explains their own field to them is the fastest way to lose them.',
  ctaMode: 'manychat',
  writerBudget: `SLIDE SHAPE AND TEXT BUDGET (HARD — measured off the Canva master itself, 2026-09-16):

THE POST IS 6 SLIDES, and two of them take a TITLE ONLY:
1. COVER — title only. There is NO subtitle, hook line, or photo. Everything the cover says must fit one title of at most 32 characters.
2-5. FOUR BODY SLIDES — a title plus ONE paragraph. There are no bullets anywhere in this master; never write a list.
6. CTA — title only. There is NO punchline slot, so the entire call to action is the title: "DM THE WORD AUDIT".

SIZES ARE LOCKED. The master sets body copy at 32pt and the title at a fixed display size, and NEITHER IS EVER RESIZED — not by you, not by the designer, not by the runner. The copy adapts to the box; the box never adapts to the copy.

- BODY-SLIDE TITLE: at most 26 characters, at most 3 lines.
- COVER / CTA TITLE: at most 32 characters, at most 5 lines.
- NO SINGLE WORD LONGER THAN 10 CHARACTERS in any title — the title wraps at roughly 10 characters and there is no smaller size to fall back to, so one long word breaks the slide outright.
- BODY PARAGRAPH: at most 5 lines at roughly 28 characters per line — at most 22 words, about 140 characters. (The master's own paragraphs run 117-133 characters, so this is its real working range, not a guess.)
- WHOLE POST: at most 120 words across every slide combined.

Titles are ALL CAPS.

If an idea does not fit: cut the idea. Never split a sentence across slides to smuggle it in, never pad a short slide to fill space. A slide with three words on it is finished; a slide that overflows is broken, because nothing downstream can shrink it.`,
  manychatKeywordsBlock: YEDINO_MANYCHAT_KEYWORDS,
  complianceFacts: YEDINO_COMPLIANCE_FACTS,
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry + lookup
// ─────────────────────────────────────────────────────────────────────────────

const PROFILES: Record<string, NicheProfile> = {
  regenerative_medicine: REGENMED_PROFILE,
  aesthetics: AESTHETICS_PROFILE,
  yedino: YEDINO_PROFILE,
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
