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
// Photo direction v3 (Igor, 2026-07-29): CONTEXT-FIRST + real Hawaii
// photography. Every image must match what the slide actually talks
// about — no random abstraction. Source priority: real photo (Canva
// stock library, esp. Hawaii nature + people + device macros) →
// contextual 3D medical render → photoreal Flux. People are WELCOME on
// up to ~half the slides (natural Hawaiian/Polynesian scenes), just
// NEVER a close-up face (cover included). BANNED: abstract
// gold-crystal / marble / generic "organic texture" backgrounds — they
// read as filler, not content. safety_tolerance:6 is enforced at
// Replicate call time. See docs/POST-CRAFT.md §5.
const NEG = 'No text, no lettering, no watermark, no logo, no blank label placeholder, no distorted or extra limbs, no uncanny faces, not abstract.'

const PEOPLE_LINE =
  'Cinematic editorial photograph, Native Hawaiian or Polynesian subject in a natural Hawaii setting relevant to the slide (ocean, beach, palms, volcanic coast, garden, or a warm real-life moment), medium-wide or environmental framing showing the full figure or upper body from behind or three-quarter, face NOT close to camera and never a portrait, soft natural light, muted teal and warm amber colour grade, premium wellness brand photography, photoreal, 35mm, high detail. ' + NEG

const RENDER_LINE =
  'Premium 3D medical render, anatomically correct and true to the named structure, glass-like translucent anatomy, deep teal background with warm amber glow accents, cinematic studio lighting, shallow depth of field, ultra high detail, aesthetic scientific visualization in the style of high-end pharma advertising. ' + NEG + ' No people.'

// Real Hawaii place/nature — a REAL photograph look, never abstract.
const AESTHETIC_LINE =
  'Cinematic photoreal photograph of a real, recognisable Hawaii scene relevant to the slide (coastline, ocean surface, palms, volcanic rock, lush greenery), muted teal and warm amber colour grade, soft natural light, premium wellness brand look, 35mm, high detail. A real place — NOT an abstract texture, gold-crystal or marble pattern. No people. ' + NEG

const SYSTEM_PROMPT = `You decide what visual each slide in an HWC Instagram carousel should show. The clinic's look is CONTEXT-FIRST + real Hawaii photography: every image must MATCH what the slide is actually about, and real-photo looks (people, Hawaii places, device macros) are preferred over abstraction. Renders are for biology/mechanism only.

CRITICAL RULE: Every subject and prompt MUST specifically reference the treatment, condition, or mechanism named in that slide's heading. Generic or abstract fillers ("HWC patient wellness moment", a gold-crystal / marble / generic organic texture) are WRONG. If the slide is about a joint, show the joint; about a drug, show the pen/vial; about a decision, show a real person or place — not a pretty abstraction.

You receive a finished PostPlan (cover + body slides + cta) and emit a photo_brief array, one entry per slide.

MIX TARGET (BINDING): across the whole post aim for roughly **60% "ai" / 40% "stock"**. Here "stock" means a REAL-PHOTO look (photoreal Flux — real people, real Hawaii scenes, real device macros), the opposite of an abstract render. Reach the 40% via the people slides, the Hawaii-place slides, and the device/procedure slides.

SOURCE DECISION (pick exactly one per slide):
  • "ai"       — Replicate Flux. Two render/art modes for when a real photo won't serve:
      RENDER    — 3D medical visualization of the organ/hormone/molecule/receptor/process the slide names (translucent 3D stomach with GLP-1 receptors, a molecule, neural pathways). Use for mechanism / biology / "what it is" slides.
      PEOPLE    — a Native Hawaiian/Polynesian person in a natural Hawaii setting relevant to the slide, full figure or upper body, medium-wide, face NOT close. People are WELCOME on up to ~HALF the slides — patient-story beats, candidacy, "who it's for", emotional turns. Natural scenes, not studio portraits.
  • "stock"    — a REAL photograph (photoreal look): (a) a device/procedure macro (injection pen, IV drip, vials, coil); (b) a real Hawaii place/nature scene matching the slide (coastline, ocean, palms, volcanic rock); (c) a real candid person moment when a photo beats a render. This carries the ~40% real-photo share. NEVER abstract.
  • "fallback" — no image. Rare; only when a slide truly works as pure brand surface.

MODE HINTS:
  • Mechanism / biology / "what the data shows" → ai RENDER of the named organ/molecule/process.
  • Device / procedure / drug named → STOCK device macro (pen, vial, coil).
  • Patient story / emotional beat → PEOPLE (ai) or a real candid STOCK person.
  • Candidacy / "who it's for" → PEOPLE or a real Hawaii place STOCK.
  • Analogy ("think of it this way") → STOCK real Hawaii scene that embodies the analogy (not abstract).
  • CTA → STOCK wide Hawaii coastline, or PEOPLE outdoors.

HARD RULES:
  • Cover (n=1): ALWAYS "fallback" — NO photo. The cover keeps the template's clean branded design (gradient / brand surface), like the old designs. Never put a photo or render on the cover.
  • People may appear on up to ~HALF the slides; NEVER a close-up face on any slide. Real people (stock/Pexels) are preferred over AI people.
  • Prefer REAL photos ("stock" → Pexels) over AI wherever a real photo works (people, Hawaii places, devices). Use "ai" only for 3D medical RENDERS (no real photo exists for those).
  • NO abstract backgrounds (gold-crystal, marble, generic "organic texture") anywhere — always a concrete, on-topic subject.
  • Every ai prompt MUST include "dark lower third" — the teal text panel overlays there. For PEOPLE mode also include "subject in upper two-thirds of frame".
  • Never put clinical equipment in a PEOPLE prompt — devices go to "stock" macro or RENDER.
  • Never use vague subjects: always name the specific condition, treatment, molecule, place, or story from the slide.

Style line to append verbatim to each ai prompt, by mode:
  RENDER    → "${RENDER_LINE}"
  AESTHETIC → "${AESTHETIC_LINE}"
  PEOPLE    → "${PEOPLE_LINE}"

Respond with ONLY valid JSON, no markdown fences:
{
  "photo_brief": [
    { "n": 1, "source": "ai", "subject": "...", "prompt": "<specific subject sentence>, dark lower third. ${RENDER_LINE}", "keywords": null },
    { "n": 2, "source": "stock", "subject": "injection pen macro", "prompt": null, "keywords": ["semaglutide injection pen", "medical pen macro"] },
    { "n": 4, "source": "ai", "subject": "Native Hawaiian patient on the coast", "prompt": "<specific person + scene>, subject in upper two-thirds of frame, dark lower third. ${PEOPLE_LINE}", "keywords": null },
    { "n": 7, "source": "stock", "subject": "CTA — real Hawaii coastline", "prompt": null, "keywords": ["hawaii coastline golden hour", "turquoise ocean volcanic rock"] }
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

  // Cover (n=1) — NO photo (Igor 2026-07-30): the cover keeps the template's
  // clean branded design (gradient / brand surface), like the old designs.
  // Never inject a photo or render here. Forced fallback, ignore the LLM.
  normalized.push({
    n: 1,
    source: 'fallback',
    subject: 'Cover — no photo, keep the template branded cover',
    prompt: null,
    keywords: null,
  })

  // Body slides — heuristic default is an on-topic visual keyed to the
  // slide heading (v3: never abstract). The LLM brief decides people vs
  // render vs stock; this is only the fallback when it's missing.
  for (const slide of params.slides) {
    const found = briefs.find((b) => b?.n === slide.n)
    const heuristic = {
      source: 'ai' as const,
      subject: slide.heading ?? slide.intro ?? 'On-topic Hawaii scene',
    }
    normalized.push(normaliseBrief(found, slide.n, heuristic))
  }

  // CTA slide — real Hawaii coastline (v3: real photo, not abstract).
  // Fallback here made every post reuse the example's own background.
  const ctaN = params.slides.length + 2
  const ctaFound = briefs.find((b) => b?.n === ctaN)
  normalized.push(
    normaliseBrief(ctaFound, ctaN, {
      source: 'ai',
      subject: 'CTA — real Hawaii coastline',
    })
  )

  return balanceAiStock(normalized)
}

// Deterministic 60/40 AI/stock balance (Igor 2026-07-28). The LLM ignores a
// soft "aim for 40% stock" instruction, so enforce it in code: if too few
// slides are stock, convert the most stock-appropriate AI slides (aesthetic
// nature / device-macro, NEVER the cover, people, or 3D renders) into stock.
function balanceAiStock(briefs: PostPlanPhotoBrief[]): PostPlanPhotoBrief[] {
  const total = briefs.length
  if (total < 4) return briefs
  const targetStock = Math.round(total * 0.4)
  const stockNow = briefs.filter((b) => b.source === 'stock').length
  if (stockNow >= targetStock) return briefs

  // A slide is safe to flip to stock when it is AI, not the cover (n=1), not a
  // 3D render (keep those premium AI), and not a person shot. We detect render
  // / people by the style line baked into the prompt.
  const isRender = (p: string | null | undefined) =>
    !!p && p.includes('Premium 3D medical render')
  const isPeople = (p: string | null | undefined) =>
    !!p && p.includes('face NOT close to camera')
  const flippable = briefs.filter(
    (b) => b.source === 'ai' && b.n !== 1 && !isRender(b.prompt) && !isPeople(b.prompt)
  )
  // Prefer flipping the LATER slides (candidacy / CTA / analogy) first.
  flippable.sort((a, b) => b.n - a.n)

  let need = targetStock - stockNow
  const flipIds = new Set<number>()
  for (const b of flippable) {
    if (need <= 0) break
    flipIds.add(b.n)
    need--
  }
  return briefs.map((b) =>
    flipIds.has(b.n)
      ? {
          ...b,
          source: 'stock' as const,
          prompt: null,
          keywords:
            b.keywords && b.keywords.length
              ? b.keywords
              : deriveStockKeywords(b.subject),
        }
      : b
  )
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
  return phrase ? [phrase, 'aesthetic macro dark teal', 'hawaii nature macro'] : ['aesthetic nature macro dark teal']
}

const STOP = new Set([
  'the', 'and', 'with', 'that', 'this', 'your', 'from', 'what', 'when', 'slide',
  'aesthetic', 'visual', 'backdrop', 'wellness', 'abstract',
])

// Context-aware style-line pick for the fallback path (when the LLM brief
// omitted a per-slide prompt). Default is RENDER — most body slides are
// biology/mechanism, and a medical render is the safe on-context choice.
// AESTHETIC (real Hawaii scene) is reserved for analogy / CTA; PEOPLE for
// candidacy / patient-story headings. This fixes the v3 miss where every
// fallback slide became a generic Hawaii scene (Igor 2026-07-29).
function styleLineForSubject(subject: string): string {
  const s = subject.toLowerCase()
  if (/\b(who|candidacy|candidate|patient|story|worth exploring|for you|right for)\b/.test(s)) {
    return PEOPLE_LINE
  }
  if (/\b(think of it|analogy|imagine|like a|cta|follow|comment|book|coastline|hawaii|nature|next step)\b/.test(s)) {
    return AESTHETIC_LINE
  }
  return RENDER_LINE
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
        : `${subject}, dark lower third. ${styleLineForSubject(subject)}`
      : null
  const keywords =
    source === 'stock'
      ? Array.isArray(raw?.keywords)
        ? raw!.keywords!.filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
        : null
      : null
  return { n, source, subject, prompt, keywords }
}
