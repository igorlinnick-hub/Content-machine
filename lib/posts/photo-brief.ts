import { MODEL_DEFAULT, callAgentJSON } from '@/lib/agents/base'
import type {
  PostPlanBodySlide,
  PostPlanCover,
  PostPlanCta,
  PostPlanPhotoBrief,
} from '@/types'

// Produces the per-slide photo_brief[] that ships with PostPlan to the
// Canva pipeline. The brief is intentionally LIGHT: subject + source
// decision + (for AI) a prompt template + (for stock) keywords. The
// downstream consumer (Canva compose endpoint) resolves the source
// into actual bytes — Replicate Flux for 'ai', Drive folder lookup
// for 'drive', Unsplash for 'stock', brand surface for 'fallback'.
//
// Photo direction v2 (Igor, 2026-07-23): aesthetic-first, people-light.
// Most slides carry premium 3D medical renders (organs, processes,
// molecules) or aesthetic Hawaii nature — NOT people. People appear on
// at most 1-2 slides per post, always in outdoor Hawaii locations,
// never generic interiors, and NEVER as a close-up face on the cover.
// safety_tolerance:6 is enforced at Replicate call time, not in the
// prompt string.
const PEOPLE_LINE =
  'Cinematic editorial photograph, Native Hawaiian or Polynesian subject in an outdoor Hawaii location (ocean, beach, palms, volcanic coast, lush garden), medium-wide framing showing the full figure, face NOT close to camera, soft natural light, muted teal and warm amber colour grade, premium wellness brand photography, photoreal, 35mm, high detail. No text overlay.'

const RENDER_LINE =
  'Premium 3D medical render, glass-like translucent anatomy, deep teal background with warm amber glow accents, cinematic studio lighting, ultra high detail, aesthetic scientific visualization in the style of high-end pharma advertising. No text overlay, no people.'

const AESTHETIC_LINE =
  'Cinematic aesthetic photograph, Hawaii nature or abstract organic detail, muted teal and warm amber colour grade, soft directional light, premium wellness brand look, high detail. No people, no text overlay.'

const SYSTEM_PROMPT = `You decide what visual each slide in an HWC Instagram carousel should show. The clinic's look is AESTHETIC-FIRST: premium 3D medical renders and Hawaii nature imagery, with people used sparingly.

CRITICAL RULE: Every subject and prompt MUST specifically reference the treatment, condition, or mechanism named in that slide's heading. Generic descriptions like "HWC patient wellness moment" or "doctor and patient talking" are WRONG.

You receive a finished PostPlan (cover + body slides + cta) and emit a photo_brief array, one entry per slide.

SOURCE DECISION (pick exactly one per slide):
  • "ai"       — Replicate Flux, the DEFAULT for almost every slide. Three visual modes (pick per slide, encode in the prompt):
      RENDER    — 3D medical visualization: the organ, hormone, molecule, receptor, or biological process the slide names (e.g. translucent 3D stomach with GLP-1 receptors glowing, a semaglutide molecule, neural pathways lighting up). DEFAULT for mechanism / biology / data / "what it is" slides.
      AESTHETIC — Hawaii nature or abstract organic detail matching the slide's idea (ocean water for a "signal" analogy, volcanic rock strata for "layers", morning light through palms for "recovery"). DEFAULT for analogy slides and the CTA.
      PEOPLE    — a Native Hawaiian/Polynesian person in an OUTDOOR HAWAII location, full figure, medium-wide framing. ONLY for the emotional heart of a patient story. HARD BUDGET: at most 2 people slides per post, and people NEVER appear in generic interiors, offices, or clinic rooms.
  • "stock"    — real-object macro only (a specific device or procedure close-up: TMS coil, injection pen, IV drip, vials). NEVER people. Dark-toned, aesthetic framing.
  • "fallback" — no image. Use ONLY when a slide genuinely works better as pure brand surface; rare.

MODE HINTS:
  • Mechanism/biology/"what the data shows" → ai RENDER of the named organ/molecule/process.
  • Peptides → ai RENDER of peptide chains / cellular repair, or stock macro of vials.
  • Ketamine/Spravato/TMS → ai RENDER of neural pathways / brain regions.
  • Weight loss/GLP-1 → ai RENDER of gut-brain hormone signalling; ONE people slide max for the story beat.
  • Analogy ("think of it this way") → ai AESTHETIC visual that embodies the analogy.
  • CTA → ai AESTHETIC wide Hawaii nature shot.

HARD RULES:
  • Cover (n=1): always "ai". NEVER a close-up face — either a full-figure person seen at a distance in an outdoor Hawaii location, or (often better) a striking RENDER/AESTHETIC visual of the post topic. The face must never dominate the cover.
  • At most 2 slides in the whole post may contain people; 0 is fine.
  • Every ai prompt MUST include "dark lower third" — the teal text panel overlays there. For PEOPLE mode also include "subject in upper two-thirds of frame".
  • Never put clinical equipment in a PEOPLE prompt — devices go to "stock" macro or RENDER.
  • Never use vague subjects: always name the specific condition, treatment, molecule, or story from the slide.

Style line to append verbatim to each ai prompt, by mode:
  RENDER    → "${RENDER_LINE}"
  AESTHETIC → "${AESTHETIC_LINE}"
  PEOPLE    → "${PEOPLE_LINE}"

Respond with ONLY valid JSON, no markdown fences:
{
  "photo_brief": [
    { "n": 1, "source": "ai", "subject": "...", "prompt": "<specific subject sentence>, dark lower third. ${RENDER_LINE}", "keywords": null },
    { "n": 2, "source": "stock", "subject": "...", "prompt": null, "keywords": ["specific device", "specific procedure"] },
    { "n": 7, "source": "ai", "subject": "CTA — Hawaii nature backdrop", "prompt": "<aesthetic Hawaii scene>, dark lower third. ${AESTHETIC_LINE}", "keywords": null }
  ]
}`

export async function generatePhotoBriefs(params: {
  cover: PostPlanCover
  slides: PostPlanBodySlide[]
  cta: PostPlanCta
  topic?: string | null
  category?: string | null
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

  // Cover (n=1)
  normalized.push(normaliseBrief(briefs.find((b) => b?.n === 1), 1, {
    source: 'ai',
    subject: params.cover.title ?? params.topic ?? 'HWC patient — editorial wellness portrait',
  }))

  // Body slides — heuristic default is an aesthetic no-people visual,
  // never a person (people are budgeted by the LLM brief, max 2/post).
  for (const slide of params.slides) {
    const found = briefs.find((b) => b?.n === slide.n)
    const heuristic = {
      source: 'ai' as const,
      subject: slide.heading ?? slide.intro ?? 'Abstract wellness visual',
    }
    normalized.push(normaliseBrief(found, slide.n, heuristic))
  }

  // CTA slide — aesthetic Hawaii nature, no people. Fallback here made
  // every post reuse the example design's own background photo.
  const ctaN = params.slides.length + 2
  const ctaFound = briefs.find((b) => b?.n === ctaN)
  normalized.push(
    normaliseBrief(ctaFound, ctaN, {
      source: 'ai',
      subject: 'CTA — aesthetic Hawaii nature backdrop',
    })
  )

  return normalized
}

function normaliseBrief(
  raw: Partial<PostPlanPhotoBrief> | undefined,
  n: number,
  fallback: { source: 'ai' | 'stock' | 'fallback'; subject: string }
): PostPlanPhotoBrief {
  const source: 'ai' | 'stock' | 'fallback' =
    raw?.source === 'ai' ||
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
        : `${subject}, dark lower third. ${AESTHETIC_LINE}`
      : null
  const keywords =
    source === 'stock'
      ? Array.isArray(raw?.keywords)
        ? raw!.keywords!.filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
        : null
      : null
  return { n, source, subject, prompt, keywords }
}
