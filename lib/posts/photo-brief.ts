import { MODEL_DEFAULT, callAgentJSON } from '@/lib/agents/base'
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
const NEG =
  'No text, no lettering, no watermark, no logo, no blank label placeholder, no distorted or extra limbs, no uncanny faces, not abstract.'

const RENDER_LINE =
  'Clean, minimal, EDITORIAL 3D anatomical render of the EXACT organ / body part / cell / molecule the slide is about (e.g. a glowing heart inside a translucent torso, a DNA double helix, a cell receptor, a molecular model, an anatomical body scan / medical sculpture). Dark, moody, premium background; soft studio lighting; shallow depth of field; real-photo render quality; elegant and clinical — the @dr.vassily aesthetic. Show the REAL structure in context. NOT abstract, no gold-crystal, no marble, no generic organic texture. ' +
  NEG +
  ' No people.'

// Real Hawaii place/nature — a REAL photograph look, never abstract.
const AESTHETIC_LINE =
  'Cinematic photoreal photograph of a real, recognisable Hawaii scene relevant to the slide (coastline, ocean surface, palms, volcanic rock, lush greenery), muted teal and warm amber colour grade, soft natural light, premium wellness brand look, 35mm, high detail. A real place — NOT an abstract texture, gold-crystal or marble pattern. No people. ' +
  NEG

const MAX_STOCK_PER_POST = 2
const CLINIC_SHARE = 0.4

const SYSTEM_PROMPT = `You decide what visual each slide in an HWC Instagram carousel should show. The clinic's look is CONTEXT-FIRST: every image must MATCH what the slide is actually about. Real photography is preferred over abstraction; renders are for biology and mechanism only.

CRITICAL RULE: Every subject and prompt MUST specifically reference the treatment, condition, or mechanism named in that slide's heading. Generic or abstract fillers (a gold-crystal / marble / generic organic texture, "HWC patient wellness moment") are WRONG. If the slide is about a joint, show the joint; about a drug, show the pen/vial; about the team or the visit, show the real clinic.

You receive a finished PostPlan (cover + body slides + cta) and emit a photo_brief array, one entry per slide.

MIX TARGET (BINDING): about **40% "clinic"**, at most **${MAX_STOCK_PER_POST} "stock"** in the whole post, everything else "ai".

SOURCE DECISION (pick exactly one per slide):
  • "clinic"   — a REAL photograph from the clinic's own library: the doctor, the team, a treatment room, a device in real hands, a candid real moment, the building, Hawaii shot by us. Use this for anything human, anything about the visit, candidacy, "who it's for", trust, the team, and the CTA. NO prompt and NO keywords — just a precise \`subject\` describing what the photo should show, so the library matcher can find it.
  • "ai"       — Replicate Flux, TWO modes only:
      RENDER    — a CLEAN, STYLISH 3D anatomical/medical render of the EXACT body part, organ, cell, molecule or process the slide names. Dark, minimal, editorial. Use for mechanism / biology / "what the data shows".
      AESTHETIC — a real Hawaii place or nature scene that fits the slide (coastline, ocean, palms, volcanic rock). Use for analogy beats and palate cleansers.
      NEVER generate people. Humans come from the clinic library only.
  • "stock"    — Pexels. ONLY for a concrete object the clinic library cannot supply: a lab/blood-tube rack, an injection pen macro, a vial, a piece of equipment. Maximum ${MAX_STOCK_PER_POST} per post. Never a person, never a landscape (we have both).
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
  AESTHETIC → "${AESTHETIC_LINE}"

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

export async function generatePhotoBriefs(params: {
  cover: PostPlanCover
  slides: PostPlanBodySlide[]
  cta: PostPlanCta
  topic?: string | null
  category?: string | null
  /** When set (with a library folder on the clinic) the `clinic` slides
   *  get a real Drive file id from the LRU rotation. Without it they
   *  degrade to `ai` rather than shipping a source nothing can resolve. */
  clinicId?: string | null
  photoLibraryFolderId?: string | null
}): Promise<PostPlanPhotoBrief[]> {
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
      systemPrompt: SYSTEM_PROMPT,
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
      normaliseBrief(found, slide.n, {
        source: 'ai',
        subject: slide.heading ?? slide.intro ?? 'On-topic clinical subject',
      })
    )
  }

  // CTA slide — the real clinic (v4). Fallback here made every post
  // reuse the example's own background.
  const ctaN = params.slides.length + 2
  normalized.push(
    normaliseBrief(briefs.find((b) => b?.n === ctaN), ctaN, {
      source: 'clinic',
      subject: 'CTA — the clinic team or the real place',
    })
  )

  const mixed = enforceMix(normalized)
  return resolveClinicPicks(mixed, params.clinicId, params.photoLibraryFolderId)
}

// Deterministic mix enforcement (v4). The LLM drifts on soft targets, so
// the shares are settled in code: ~40% clinic, Pexels capped, the rest AI.
function enforceMix(briefs: PostPlanPhotoBrief[]): PostPlanPhotoBrief[] {
  const total = briefs.length
  if (total < 4) return briefs
  let out = [...briefs]

  // 1. Cap Pexels. Overflow becomes clinic — a real clinic photo beats a
  //    stock stranger every time.
  let stockSeen = 0
  out = out.map((b) => {
    if (b.source !== 'stock') return b
    stockSeen += 1
    if (stockSeen <= MAX_STOCK_PER_POST) return b
    return { ...b, source: 'clinic' as const, prompt: null, keywords: null }
  })

  // 2. Top clinic up to its share by converting AI slides — never the
  //    cover, and never a 3D render (those are the premium AI slides).
  const targetClinic = Math.round(total * CLINIC_SHARE)
  const clinicNow = out.filter((b) => b.source === 'clinic').length
  if (clinicNow >= targetClinic) return out

  const isRender = (p: string | null | undefined) =>
    !!p && p.includes('EDITORIAL 3D anatomical render')
  const flippable = out
    .filter((b) => b.source === 'ai' && b.n !== 1 && !isRender(b.prompt))
    // Later slides (candidacy / CTA / analogy) flip first.
    .sort((a, b) => b.n - a.n)

  const flip = new Set(flippable.slice(0, targetClinic - clinicNow).map((b) => b.n))
  return out.map((b) =>
    flip.has(b.n) ? { ...b, source: 'clinic' as const, prompt: null, keywords: null } : b
  )
}

// Turn every `clinic` brief into a concrete Drive file via the LRU
// rotation. Anything the library can't cover degrades to an AI render
// rather than shipping a source the runner cannot resolve.
async function resolveClinicPicks(
  briefs: PostPlanPhotoBrief[],
  clinicId?: string | null,
  folderId?: string | null
): Promise<PostPlanPhotoBrief[]> {
  const wanted = briefs.filter((b) => b.source === 'clinic')
  if (wanted.length === 0) return briefs

  const degrade = (b: PostPlanPhotoBrief): PostPlanPhotoBrief => ({
    ...b,
    source: 'ai',
    prompt: `${b.subject}, dark lower third. ${styleLineForSubject(b.subject)}`,
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

// Style-line pick for the fallback path (when the LLM omitted a prompt).
// Default is RENDER — most body slides are biology/mechanism, and a
// medical render is the safe on-context choice. AESTHETIC is for
// analogy beats. There is no PEOPLE mode any more (v4).
function styleLineForSubject(subject: string): string {
  const s = subject.toLowerCase()
  if (/\b(think of it|analogy|imagine|like a|coastline|hawaii|nature|ocean|island)\b/.test(s)) {
    return AESTHETIC_LINE
  }
  return RENDER_LINE
}

function normaliseBrief(
  raw: Partial<PostPlanPhotoBrief> | undefined,
  n: number,
  fallback: { source: PostPlanPhotoBrief['source']; subject: string }
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
  const prompt =
    source === 'ai'
      ? typeof raw?.prompt === 'string' && raw.prompt.trim().length > 0
        ? raw.prompt.trim()
        : `${subject}, dark lower third. ${styleLineForSubject(subject)}`
      : null
  const keywords =
    source === 'stock'
      ? Array.isArray(raw?.keywords) && raw.keywords.length
        ? raw.keywords.filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
        : deriveStockKeywords(subject)
      : null
  return { n, source, subject, prompt, keywords, drive_file_id: null }
}
