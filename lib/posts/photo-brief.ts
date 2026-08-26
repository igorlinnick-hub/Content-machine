import { MODEL_DEFAULT, callAgentJSON } from '@/lib/agents/base'
import { getNicheProfile } from '@/lib/niche/profiles'
import { pickClinicPhotos } from '@/lib/photos/clinic'
import { clinicPhotoUrl } from '@/lib/photos/clinic-url'
import { getPhotoLibraryFolderId } from '@/lib/photos/photo-lib'
import type {
  PostPlanBodySlide,
  PostPlanCover,
  PostPlanCta,
  PostPlanPhotoBrief,
} from '@/types'

// Produces the per-slide photo_brief[] that ships with PostPlan to the
// Canva pipeline. The brief is LIGHT: subject + source decision +
// (for AI) a prompt + (for stock) keywords + (for clinic) a resolved
// Drive file id. The downstream consumer turns the source into bytes.
//
// PHOTO DIRECTION v4 (Igor, 2026-08-17) — supersedes v3:
//   • AI is for 3D medical RENDERS and Hawaii NATURE only. No more AI
//     people: generated humans were the weakest thing in every post,
//     and the clinic now has its own photo library.
//   • CLINIC (~40%) — real photographs from the clinic's Drive library:
//     the doctor, the team, the rooms, the devices, real moments.
//   • STOCK (Pexels) is capped at 1-2 per post, for explicit context a
//     clinic photo can't supply (a lab rack, an injection pen macro).
//   • Cover: no photo, keep the template's branded surface.
//   • Never an abstract background (gold-crystal, marble, "organic
//     texture") — always a concrete, on-topic subject.
//
// v4.1 — THE DOCTRINE IS PER NICHE (Igor, 2026-08-26). Until now every
// clinic got the regenmed look: 3D organs + Hawaii scenery + the shared
// Drive folder, so an aesthetics post about jawline lines opened on the
// same glowing heart and the same desk photo as a NAD+ post. The
// regenerative_medicine doctrine below is v4 verbatim (zero change for
// Dr. Shawn). The aesthetics doctrine is new: real SKIN macros of the
// exact area (never a face — cropped below the eyes, from behind, or a
// hand / neck / shoulder), still-life TOOLS (syringe, cannula, pen,
// handpiece, dropper — never entering skin), empty treatment ROOMs, and
// Hawaii BOTANICAL detail for analogies. No renders, no AI people, and a
// smaller clinic share, because the shared library is mostly team/desk.
const NEG =
  'No text, no lettering, no watermark, no logo, no blank label placeholder, no distorted or extra limbs, no uncanny faces, not abstract.'

// ── regenerative_medicine — v4, verbatim ─────────────────────────────

const RENDER_LINE =
  'Clean, minimal, EDITORIAL 3D anatomical render of the EXACT organ / body part / cell / molecule the slide is about (e.g. a glowing heart inside a translucent torso, a DNA double helix, a cell receptor, a molecular model, an anatomical body scan / medical sculpture). Dark, moody, premium background; soft studio lighting; shallow depth of field; real-photo render quality; elegant and clinical — the @dr.vassily aesthetic. Show the REAL structure in context. NOT abstract, no gold-crystal, no marble, no generic organic texture. ' +
  NEG +
  ' No people.'

// Real Hawaii place/nature — a REAL photograph look, never abstract.
const HAWAII_LINE =
  'Cinematic photoreal photograph of a real, recognisable Hawaii scene relevant to the slide (coastline, ocean surface, palms, volcanic rock, lush greenery), muted teal and warm amber colour grade, soft natural light, premium wellness brand look, 35mm, high detail. A real place — NOT an abstract texture, gold-crystal or marble pattern. No people. ' +
  NEG

const REGENMED_MAX_STOCK = 2
const REGENMED_CLINIC_SHARE = 0.4

const REGENMED_SYSTEM_PROMPT = `You decide what visual each slide in an HWC Instagram carousel should show. The clinic's look is CONTEXT-FIRST: every image must MATCH what the slide is actually about. Real photography is preferred over abstraction; renders are for biology and mechanism only.

CRITICAL RULE: Every subject and prompt MUST specifically reference the treatment, condition, or mechanism named in that slide's heading. Generic or abstract fillers (a gold-crystal / marble / generic organic texture, "HWC patient wellness moment") are WRONG. If the slide is about a joint, show the joint; about a drug, show the pen/vial; about the team or the visit, show the real clinic.

You receive a finished PostPlan (cover + body slides + cta) and emit a photo_brief array, one entry per slide.

MIX TARGET (BINDING): about **40% "clinic"**, at most **${REGENMED_MAX_STOCK} "stock"** in the whole post, everything else "ai".

SOURCE DECISION (pick exactly one per slide):
  • "clinic"   — a REAL photograph from the clinic's own library: the doctor, the team, a treatment room, a device in real hands, a candid real moment, the building, Hawaii shot by us. Use this for anything human, anything about the visit, candidacy, "who it's for", trust, the team, and the CTA. NO prompt and NO keywords — just a precise \`subject\` describing what the photo should show, so the library matcher can find it.
  • "ai"       — Replicate Flux, TWO modes only:
      RENDER    — a CLEAN, STYLISH 3D anatomical/medical render of the EXACT body part, organ, cell, molecule or process the slide names. Dark, minimal, editorial. Use for mechanism / biology / "what the data shows".
      AESTHETIC — a real Hawaii place or nature scene that fits the slide (coastline, ocean, palms, volcanic rock). Use for analogy beats and palate cleansers.
      NEVER generate people. Humans come from the clinic library only.
  • "stock"    — Pexels. ONLY for a concrete object the clinic library cannot supply: a lab/blood-tube rack, an injection pen macro, a vial, a piece of equipment. Maximum ${REGENMED_MAX_STOCK} per post. Never a person, never a landscape (we have both).
  • "fallback" — no image. Rare; only when a slide truly works as pure brand surface.

MODE HINTS:
  • Mechanism / biology / "what the data shows" → ai RENDER of the named organ/molecule/process.
  • Candidacy / "who it's for" / patient story / emotional turn → clinic.
  • The team, the room, the visit, what happens at the appointment → clinic.
  • Named device / drug / lab object → stock (within the cap), else clinic if we own such a photo.
  • Analogy ("think of it this way") → ai AESTHETIC Hawaii scene.
  • CTA → clinic (the real place or the real team).

HARD RULES:
  • Cover (n=1): ALWAYS "fallback" — no photo. The cover keeps the template's clean branded design.
  • NEVER an ai prompt containing people, faces, patients or doctors. That is what "clinic" is for.
  • NO abstract backgrounds anywhere — always a concrete, on-topic subject.
  • Every ai prompt MUST include "dark lower third" — the teal text panel overlays there.
  • Never use vague subjects: always name the specific condition, treatment, molecule, place, or scene from the slide.

Style line to append verbatim to each ai prompt, by mode:
  RENDER    → "${RENDER_LINE}"
  AESTHETIC → "${HAWAII_LINE}"

Respond with ONLY valid JSON, no markdown fences:
{
  "photo_brief": [
    { "n": 1, "source": "fallback", "subject": "Cover — branded, no photo", "prompt": null, "keywords": null },
    { "n": 2, "source": "ai", "subject": "...", "prompt": "<specific subject sentence>, dark lower third. ${RENDER_LINE}", "keywords": null },
    { "n": 3, "source": "stock", "subject": "blood tube rack macro", "prompt": null, "keywords": ["blood test tubes rack", "laboratory vials macro"] },
    { "n": 4, "source": "clinic", "subject": "doctor talking with a patient in the consult room", "prompt": null, "keywords": null },
    { "n": 7, "source": "clinic", "subject": "CTA — the clinic team outside the building", "prompt": null, "keywords": null }
  ]
}`

// ── aesthetics — v4.1 (Igor 2026-08-26) ──────────────────────────────
//
// Made's master (canva_style 5) is a full-bleed photo under translucent
// lavender panels, so the grade is warm-neutral with a mauve shadow tint,
// not the regenmed teal+amber. Every line is a REAL photograph: no 3D
// anatomy, no abstract texture. The face rule is structural — the crop
// itself makes a face impossible, rather than asking Flux to "avoid" one.

// Tested 2026-08-26 on Flux 1.1 pro ultra: "cropped below the eye line" gave a
// nose and lips; "the jaw seen from behind, head turned away" gave a lip-and-
// nose profile. Any facial region in the prompt yields a face. So SKIN is
// non-facial by construction — neck, shoulder, décolleté, forearm, hand —
// and face-region topics go to TOOLS or ROOM instead.
const SKIN_LINE =
  'Photoreal beauty-editorial macro photograph of real human skin on a NON-FACIAL area only — the side or nape of the neck seen from behind, a shoulder, the décolleté, a forearm, or the back of a hand. The head, if present at all, is turned fully away and cropped out: no face, no jaw, no chin, no eyes, no nose, no lips anywhere in the frame. Natural skin texture with fine visible pores and soft dewy highlights, even tone, skin of any natural tone, calm and neutral — never a "problem" close-up. Soft diffused window light, warm neutral palette with a gentle lavender-mauve shadow tint, shallow depth of field, 100mm macro, calm dark lower third. A real photograph — not a 3D render, not airbrushed plastic skin, not an abstract texture. No face, no text, no lettering, no watermark, no logo, no extra fingers.'

const TOOLS_LINE =
  'Photoreal still-life product photograph of the exact instrument or product the slide names, resting on a clean surface (pale stone, satin, frosted glass or a soft-lit sterile tray): a fine-gauge syringe with clear gel, a blunt-tip cannula, a microneedling pen, a laser or radiofrequency handpiece, a dermaplaning blade, a glass serum dropper, unlabelled glass vials and ampoules, sterile nitrile gloves, cotton pads, chilled globes, an LED mask on its stand. Beauty-editorial styling: soft diffused light, warm neutral palette with a gentle lavender-mauve tint, shallow depth of field, macro or three-quarter framing, calm dark lower third. A real photograph — not a 3D render, not abstract. No labels, no brand names, no text, no watermark, no faces, no people, no needle entering skin, no blood.'

const ROOM_LINE =
  'Photoreal interior photograph of a calm, empty medical-aesthetics treatment room: a treatment bed with clean white linen, a ring light or magnifying lamp, a rolling tray with sealed sterile packs, a shelf of unlabelled skincare bottles, sheer curtains, a plant, soft morning light — a spa-clinic feel. Wide or three-quarter framing, warm neutral palette with a gentle lavender-mauve tint, shallow depth of field, calm dark lower third. A real photograph — not a 3D render, not abstract. No people, no text, no lettering, no logos, no watermark.'

const BOTANICAL_LINE =
  'Photoreal macro photograph of a real Hawaii botanical or water detail that carries the analogy: water beading on a ti or monstera leaf, a plumeria flower on wet volcanic stone, soft ocean light on wet sand, a sliced citrus on stone. Soft diffused light, warm neutral palette with a gentle lavender-mauve tint, shallow depth of field, calm dark lower third. A real photograph — not an abstract texture, not gold-crystal or marble. No people, no text, no lettering, no watermark, no logo.'

const AESTHETICS_MAX_STOCK = 2
// The shared Drive library is team / desk / treatment-room shots of the
// regenmed side. For an aesthetics post that is the CTA plus at most one
// trust slide; skin, tools and rooms carry the rest.
const AESTHETICS_CLINIC_SHARE = 0.25

const AESTHETICS_SYSTEM_PROMPT = `You decide what visual each slide in a medical-aesthetics Instagram carousel should show (a cosmetic injector / skin clinic). The look is BEAUTY-EDITORIAL and CONTEXT-FIRST: every image must MATCH what the slide is actually about, and it must read as a REAL photograph — soft light, real skin, real instruments, real rooms. No 3D anatomy renders (that is the regenerative-medicine look, not this clinic's), no abstract textures.

CRITICAL RULES:
  • Every subject and prompt MUST name the treatment, skin area, product or step the slide is about. Generic fillers are WRONG.
  • NO FACES, EVER, in generated images. Skin is shown ONLY on a non-facial area — the side or nape of the neck from behind, décolleté, a shoulder, a forearm, the back of the hand. Any facial region in a prompt (cheek, jaw, chin, forehead, "below the eyes", "from behind the ear") produces a face on Flux — measured — so those words never go into a SKIN prompt.
  • NO generated people. Humans come only from the clinic's own library ("clinic").
  • Instruments are STILL LIFE — a syringe or cannula resting on a tray, never entering skin, no blood, no mid-injection shots.

You receive a finished PostPlan (cover + body slides + cta) and emit a photo_brief array, one entry per slide.

MIX TARGET (BINDING): about **25% "clinic"** — the CTA plus at most ONE body slide (the library is mostly team and office shots, so skin / tool / room imagery carries the post) — at most **${AESTHETICS_MAX_STOCK} "stock"**, everything else "ai".

SOURCE DECISION (pick exactly one per slide):
  • "clinic"   — a REAL photograph from the clinic's own library: the doctor, the team, the front desk, a consult moment, the building. Use for the CTA and for at most one trust / "the visit" slide. NO prompt and NO keywords — just a precise \`subject\` so the library matcher can find it.
  • "ai"       — Replicate Flux, FOUR modes:
      SKIN      — photoreal macro of real skin on a NON-FACIAL area that carries the slide's point (neck crepe or fine lines on the side of the neck, pores and hydration on the nape or shoulder, sun spots on the back of the hand, post-treatment glow on the décolleté). Use for mechanism ("what happens in the skin"), hydration / texture / collagen beats, results timelines, candidacy.
      TOOLS     — photoreal still life of the actual instrument / product: a syringe with clear gel, a blunt cannula, a microneedling pen, a laser / RF handpiece, a dermaplaning blade, a glass serum dropper, unlabelled vials and ampoules, sterile gloves, cotton pads, chilled globes, an LED mask on its stand, an unlabelled SPF bottle. Use for "how it's done", "what to expect", aftercare, the at-home routine, product comparisons.
      ROOM      — photoreal interior of a calm aesthetics treatment room, empty of people: treatment bed with white linen, ring light / magnifying lamp, rolling tray, product shelf, sheer curtains, morning light. Use for "the visit", "what the appointment looks like", consult / pricing beats, palate cleansers.
      BOTANICAL — a real Hawaii botanical / water detail as the analogy: water beading on a ti or monstera leaf, plumeria on wet stone, soft ocean light on sand, sliced citrus. ONLY for analogy beats.
  • "stock"    — Pexels, objects only: a serum dropper macro, a syringe on marble, a microneedling pen, cotton pads. Maximum ${AESTHETICS_MAX_STOCK} per post. Never a person, never a face, never a landscape.
  • "fallback" — no image. Rare; only when a slide truly works as pure brand surface.

MODE HINTS:
  • Mechanism / "what happens in the skin" / collagen, elastin, hydration, pores, muscle relaxation → ai SKIN of that exact area.
  • The concern the reader feels (neck lines, dull skin, sun spots on the hands) → ai SKIN of that exact area, calm and neutral — never a "problem face".
  • A FACE-REGION topic (forehead lines, the 11s, crow's feet, under-eye, lips, cheeks, chin, jawline, jowls) → the area itself cannot be shown without a face, so use ai TOOLS (the syringe / product of that treatment) or ai ROOM, or a stand-in SKIN macro of the neck or hand for the "what happens in the skin" beat. NEVER attempt a forehead, eye, lip, cheek or jaw macro.
  • The product / the tool / units / what the needle actually is → ai TOOLS (or stock, within the cap).
  • The appointment, what to expect, downtime, the consult → ai ROOM, or clinic for the one trust slide.
  • Aftercare, routine, SPF, what to avoid → ai TOOLS (dropper, unlabelled SPF bottle, chilled globes, cotton pads).
  • Analogy ("think of it this way") → ai BOTANICAL.
  • Who it's for / candidacy → ai SKIN, or clinic.
  • CTA → clinic (the real team or the real place).

HARD RULES:
  • Cover (n=1): ALWAYS "fallback" — no photo; the style rewrite handles the cover at compose time.
  • NEVER an ai prompt that could show eyes, a nose, lips, a full face, a portrait, a "model", a "woman smiling", a patient being treated. Re-frame to a face-safe area, a tool, or a room.
  • NO needle-in-skin, NO blood, NO bruising, NO before/after split images.
  • NO 3D renders, NO abstract textures, NO gold-crystal / marble backgrounds.
  • Every ai prompt MUST include "calm dark lower third" — the text panel overlays there.
  • Skin of any natural tone is welcome; vary it across the post.
  • Never use vague subjects: always name the specific area, treatment, product, or step from the slide.

Style line to append verbatim to each ai prompt, by mode:
  SKIN      → "${SKIN_LINE}"
  TOOLS     → "${TOOLS_LINE}"
  ROOM      → "${ROOM_LINE}"
  BOTANICAL → "${BOTANICAL_LINE}"

Respond with ONLY valid JSON, no markdown fences:
{
  "photo_brief": [
    { "n": 1, "source": "fallback", "subject": "Cover — branded, no photo", "prompt": null, "keywords": null },
    { "n": 2, "source": "ai", "subject": "side of the neck seen from behind, fine lines and dewy texture", "prompt": "Extreme close-up of the side and nape of the neck seen from behind, hair tucked up, fine lines and soft dewy highlights on the skin, calm dark lower third. ${SKIN_LINE}", "keywords": null },
    { "n": 3, "source": "ai", "subject": "syringe with clear hyaluronic gel and a blunt cannula on a sterile tray", "prompt": "A fine-gauge syringe filled with clear gel beside a blunt-tip cannula on a soft-lit sterile tray, calm dark lower third. ${TOOLS_LINE}", "keywords": null },
    { "n": 5, "source": "ai", "subject": "empty aesthetics treatment room in morning light", "prompt": "A calm treatment room with a white-linen bed, ring light and product shelf in soft morning light, calm dark lower third. ${ROOM_LINE}", "keywords": null },
    { "n": 6, "source": "stock", "subject": "glass serum dropper macro", "prompt": null, "keywords": ["serum dropper bottle macro", "skincare glass dropper"] },
    { "n": 8, "source": "clinic", "subject": "CTA — the clinic team at the front desk", "prompt": null, "keywords": null }
  ]
}`

// ── doctrine registry ─────────────────────────────────────────────────

interface PhotoDoctrine {
  id: 'regenerative_medicine' | 'aesthetics'
  clinicShare: number
  /** True = the clinic share is a ceiling as well as a floor. */
  capClinic: boolean
  maxStockPerPost: number
  systemPrompt: string
  /** True when the prompt already ends in one of this niche's style lines. */
  hasStyleLine: (prompt: string) => boolean
  /** Premium AI slides flip to `clinic` LAST when topping the share up. */
  isPremium: (prompt: string | null | undefined) => boolean
  /** Style line for a prompt the LLM left bare (or a clinic slide degrading to AI). */
  styleLineFor: (subject: string) => string
}

const REGENMED_DOCTRINE: PhotoDoctrine = {
  id: 'regenerative_medicine',
  clinicShare: REGENMED_CLINIC_SHARE,
  capClinic: false,
  maxStockPerPost: REGENMED_MAX_STOCK,
  systemPrompt: REGENMED_SYSTEM_PROMPT,
  hasStyleLine: (p) =>
    p.includes('EDITORIAL 3D anatomical render') ||
    p.includes('recognisable Hawaii scene'),
  // Renders are the premium AI slides, so they flip LAST — but they must
  // stay eligible. Under v4 nearly every body slide is a render, and
  // excluding them outright left one clinic photo in a seven-slide post
  // instead of three (measured 2026-08-18).
  isPremium: (p) => !!p && p.includes('EDITORIAL 3D anatomical render'),
  // Default is RENDER — most body slides are biology/mechanism, and a
  // medical render is the safe on-context choice. AESTHETIC is for
  // analogy beats. There is no PEOPLE mode any more (v4).
  styleLineFor: (subject) => {
    const s = subject.toLowerCase()
    if (/\b(think of it|analogy|imagine|like a|coastline|hawaii|nature|ocean|island)\b/.test(s)) {
      return HAWAII_LINE
    }
    return RENDER_LINE
  },
}

const AESTHETICS_DOCTRINE: PhotoDoctrine = {
  id: 'aesthetics',
  clinicShare: AESTHETICS_CLINIC_SHARE,
  capClinic: true,
  maxStockPerPost: AESTHETICS_MAX_STOCK,
  systemPrompt: AESTHETICS_SYSTEM_PROMPT,
  hasStyleLine: (p) =>
    p.includes('macro photograph of real human skin') ||
    p.includes('still-life product photograph') ||
    p.includes('interior photograph of a calm, empty') ||
    p.includes('Hawaii botanical or water detail'),
  // Skin and tools are the on-topic premium slides; a room or a leaf is
  // what a clinic photo can stand in for.
  isPremium: (p) =>
    !!p &&
    (p.includes('macro photograph of real human skin') ||
      p.includes('still-life product photograph')),
  styleLineFor: (subject) => {
    const s = subject.toLowerCase()
    if (/\b(think of it|analogy|imagine|like a|leaf|ocean|water|island|hawaii|nature)\b/.test(s)) {
      return BOTANICAL_LINE
    }
    if (/\b(room|appointment|visit|clinic|team|doctor|consult|desk|building|cta|reception)\b/.test(s)) {
      return ROOM_LINE
    }
    // A face-region subject cannot be a skin macro (any facial word → a face
    // on Flux, measured 2026-08-26); the treatment's instrument stands in.
    if (
      /\b(forehead|brows?|eyes?|under-eye|crow'?s|lips?|cheeks?|chin|jaw|jawline|jowls?|face|facial|smile|frown|11s)\b/.test(
        s
      )
    ) {
      return TOOLS_LINE
    }
    if (
      /\b(syringe|needle|cannula|pen|laser|device|handpiece|serum|spf|sunscreen|product|dropper|vial|ampoule|tool|instrument|aftercare|routine|kit|gloves|globes|mask)\b/.test(
        s
      )
    ) {
      return TOOLS_LINE
    }
    return SKIN_LINE
  },
}

function doctrineFor(niche: string | null | undefined): PhotoDoctrine {
  return getNicheProfile(niche).id === 'aesthetics' ? AESTHETICS_DOCTRINE : REGENMED_DOCTRINE
}

export async function generatePhotoBriefs(params: {
  cover: PostPlanCover
  slides: PostPlanBodySlide[]
  cta: PostPlanCta
  topic?: string | null
  category?: string | null
  /** `clinics.niche` — picks the photo doctrine. Unknown/null → regenmed (v4). */
  niche?: string | null
  /** When set (with a library folder on the clinic) the `clinic` slides
   *  get a real Drive file id from the LRU rotation. Without it they
   *  degrade to `ai` rather than shipping a source nothing can resolve. */
  clinicId?: string | null
  photoLibraryFolderId?: string | null
}): Promise<PostPlanPhotoBrief[]> {
  const doctrine = doctrineFor(params.niche)
  const compactPlan = {
    cover: { n: 1, kind: 'cover', ...params.cover },
    body: params.slides.map((s) => ({
      n: s.n,
      kind: s.kind,
      heading: s.heading,
      intro: s.intro,
      bullets: s.bullets,
      close: s.close,
    })),
    cta: { n: params.slides.length + 2, kind: 'cta', keyword: params.cta.keyword },
  }

  let raw: { photo_brief?: Array<Partial<PostPlanPhotoBrief>> } = {}
  try {
    raw = await callAgentJSON<{ photo_brief?: Array<Partial<PostPlanPhotoBrief>> }>({
      model: MODEL_DEFAULT,
      systemPrompt: doctrine.systemPrompt,
      cacheSystem: true,
      userContent: `Topic: ${params.topic ?? 'n/a'}\nCategory: ${params.category ?? 'n/a'}\n\nPostPlan:\n${JSON.stringify(compactPlan, null, 2)}\n\nEmit photo_brief now.`,
      maxTokens: 2048,
    })
  } catch (e) {
    // Soft-fail: log and return heuristic defaults so the post still
    // ships through compliance — the Canva compose step can still run,
    // just with a blunter brief.
    console.warn(
      `[photo-brief] LLM failed, using heuristic defaults: ${
        e instanceof Error ? e.message : 'unknown'
      }`
    )
  }

  const briefs = Array.isArray(raw.photo_brief) ? raw.photo_brief : []
  const normalized: PostPlanPhotoBrief[] = []

  // Cover (n=1) — NO photo (Igor 2026-07-30): the cover keeps the
  // template's clean branded design. Forced fallback, ignore the LLM.
  normalized.push({
    n: 1,
    source: 'fallback',
    subject: 'Cover — no photo, keep the template branded cover',
    prompt: null,
    keywords: null,
    drive_file_id: null,
    photo_url: null,
  })

  for (const slide of params.slides) {
    const found = briefs.find((b) => b?.n === slide.n)
    normalized.push(
      normaliseBrief(
        found,
        slide.n,
        {
          source: 'ai',
          subject: slide.heading ?? slide.intro ?? 'On-topic clinical subject',
        },
        doctrine
      )
    )
  }

  // CTA slide — the real clinic (v4). Fallback here made every post
  // reuse the example's own background.
  const ctaN = params.slides.length + 2
  normalized.push(
    normaliseBrief(
      briefs.find((b) => b?.n === ctaN),
      ctaN,
      {
        source: 'clinic',
        subject: 'CTA — the clinic team or the real place',
      },
      doctrine
    )
  )

  const mixed = enforceMix(normalized, doctrine)
  return resolveClinicPicks(mixed, doctrine, params.clinicId, params.photoLibraryFolderId)
}

// Deterministic mix enforcement (v4). The LLM drifts on soft targets, so
// the shares are settled in code: the doctrine's clinic share, Pexels
// capped, the rest AI.
function enforceMix(briefs: PostPlanPhotoBrief[], doctrine: PhotoDoctrine): PostPlanPhotoBrief[] {
  const total = briefs.length
  if (total < 4) return briefs
  let out = [...briefs]

  // 1. Cap Pexels. Overflow becomes clinic — a real clinic photo beats a
  //    stock stranger every time.
  let stockSeen = 0
  out = out.map((b) => {
    if (b.source !== 'stock') return b
    stockSeen += 1
    if (stockSeen <= doctrine.maxStockPerPost) return b
    return { ...b, source: 'clinic' as const, prompt: null, keywords: null }
  })

  const targetClinic = Math.round(total * doctrine.clinicShare)
  const clinicNow = out.filter((b) => b.source === 'clinic').length

  // 2a. Too many clinic slides for a capped doctrine (aesthetics): the
  //     extras go back to AI, latest body slide first, never the CTA.
  if (doctrine.capClinic && clinicNow > targetClinic) {
    const ctaN = total
    const extras = out
      .filter((b) => b.source === 'clinic' && b.n !== ctaN)
      .sort((a, b) => b.n - a.n)
      .slice(0, clinicNow - targetClinic)
    const back = new Set(extras.map((b) => b.n))
    return out.map((b) =>
      back.has(b.n)
        ? {
            ...b,
            source: 'ai' as const,
            prompt: `${b.subject}, dark lower third. ${doctrine.styleLineFor(b.subject)}`,
            keywords: null,
          }
        : b
    )
  }

  // 2b. Top clinic up to its share by converting AI slides — never the
  //     cover, and premium AI slides last.
  if (clinicNow >= targetClinic) return out

  const byPreference = (a: PostPlanPhotoBrief, b: PostPlanPhotoBrief) => {
    const ar = doctrine.isPremium(a.prompt) ? 1 : 0
    const br = doctrine.isPremium(b.prompt) ? 1 : 0
    if (ar !== br) return ar - br
    // Within a group, later slides (candidacy / CTA / analogy) flip first.
    return b.n - a.n
  }
  const flippable = out.filter((b) => b.source === 'ai' && b.n !== 1).sort(byPreference)

  const flip = new Set(flippable.slice(0, targetClinic - clinicNow).map((b) => b.n))
  return out.map((b) =>
    flip.has(b.n) ? { ...b, source: 'clinic' as const, prompt: null, keywords: null } : b
  )
}

// Turn every `clinic` brief into a concrete Drive file via the LRU
// rotation. Anything the library can't cover degrades to an AI image in
// the niche's own doctrine rather than shipping a source the runner
// cannot resolve.
async function resolveClinicPicks(
  briefs: PostPlanPhotoBrief[],
  doctrine: PhotoDoctrine,
  clinicId?: string | null,
  folderId?: string | null
): Promise<PostPlanPhotoBrief[]> {
  const wanted = briefs.filter((b) => b.source === 'clinic')
  if (wanted.length === 0) return briefs

  const degrade = (b: PostPlanPhotoBrief): PostPlanPhotoBrief => ({
    ...b,
    source: 'ai',
    prompt: `${b.subject}, dark lower third. ${doctrine.styleLineFor(b.subject)}`,
    keywords: null,
    drive_file_id: null,
  })

  if (!clinicId) {
    console.warn('[photo-brief] no clinic id — clinic slides fall back to AI')
    return briefs.map((b) => (b.source === 'clinic' ? degrade(b) : b))
  }

  try {
    // Caller may pass the folder explicitly; otherwise it is the
    // clinic's configured library.
    const library = folderId ?? (await getPhotoLibraryFolderId(clinicId))
    if (!library) {
      console.warn(
        '[photo-brief] clinic has no photo_library_folder_id — clinic slides fall back to AI'
      )
      return briefs.map((b) => (b.source === 'clinic' ? degrade(b) : b))
    }
    const { picks, warning } = await pickClinicPhotos({
      clinicId,
      folderId: library,
      slides: wanted.map((b) => ({ n: b.n, subject: b.subject })),
    })
    if (warning) console.warn(`[photo-brief] ${warning}`)
    const byN = new Map(picks.map((p) => [p.n, p]))
    return briefs.map((b) => {
      if (b.source !== 'clinic') return b
      const pick = byN.get(b.n)
      if (!pick) return degrade(b)
      // A file id the runner cannot fetch is worse than no clinic photo:
      // it would compose a slide with an empty background. Needs both
      // CONTENT_MACHINE_SECRET and the app URL to be configured.
      const url = clinicPhotoUrl(pick.driveFileId)
      if (!url) {
        console.warn('[photo-brief] clinic photo URL not configured — falling back to AI')
        return degrade(b)
      }
      return { ...b, drive_file_id: pick.driveFileId, photo_url: url }
    })
  } catch (e) {
    console.warn(
      `[photo-brief] clinic photo selection failed: ${e instanceof Error ? e.message : 'unknown'}`
    )
    return briefs.map((b) => (b.source === 'clinic' ? degrade(b) : b))
  }
}

// Cheap keyword derivation from a subject line for a stock lookup.
function deriveStockKeywords(subject: string): string[] {
  const base = subject
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w))
    .slice(0, 4)
  const phrase = base.join(' ').trim()
  return phrase ? [phrase, 'clinical macro dark teal'] : ['medical equipment macro dark teal']
}

const STOP = new Set([
  'the', 'and', 'with', 'that', 'this', 'your', 'from', 'what', 'when', 'slide',
  'aesthetic', 'visual', 'backdrop', 'wellness', 'abstract',
])

function normaliseBrief(
  raw: Partial<PostPlanPhotoBrief> | undefined,
  n: number,
  fallback: { source: PostPlanPhotoBrief['source']; subject: string },
  doctrine: PhotoDoctrine
): PostPlanPhotoBrief {
  const source: PostPlanPhotoBrief['source'] =
    raw?.source === 'ai' ||
    raw?.source === 'clinic' ||
    raw?.source === 'stock' ||
    raw?.source === 'fallback'
      ? raw.source
      : fallback.source
  const subject =
    (typeof raw?.subject === 'string' && raw.subject.trim()) || fallback.subject
  let prompt: string | null = null
  if (source === 'ai') {
    const given = typeof raw?.prompt === 'string' ? raw.prompt.trim() : ''
    if (!given) {
      prompt = `${subject}, dark lower third. ${doctrine.styleLineFor(subject)}`
    } else if (doctrine.hasStyleLine(given)) {
      prompt = given
    } else {
      // The LLM wrote the subject but dropped the verbatim style line —
      // and with it the no-face / no-text guards. Put it back.
      prompt = `${given.replace(/[.\s]+$/, '')}. ${doctrine.styleLineFor(subject)}`
    }
  }
  const keywords =
    source === 'stock'
      ? Array.isArray(raw?.keywords) && raw.keywords.length
        ? raw.keywords.filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
        : deriveStockKeywords(subject)
      : null
  return { n, source, subject, prompt, keywords, drive_file_id: null }
}
