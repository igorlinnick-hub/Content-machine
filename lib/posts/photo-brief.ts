import { MODEL_HAIKU, callAgentJSON } from '@/lib/agents/base'
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
// Locked to the spec in
// ~/Documents/Code Projects/Hawaii Wellness Clinic/My Bots & ALL Projects/docs/projects/canva-posts.md
// section "ФОТО-логика (4 AI + 4 stock на пост)". This is the
// HWC editorial look the Canva chat tested and approved on Post 18
// (ED) + Post 16 (Peptides), 2026-06-10. Native Hawaiian / Polynesian
// human subjects, muted teal+amber colour grade, photoreal 35mm.
// safety_tolerance:6 is enforced at Replicate call time, not in the
// prompt string.
const STYLE_LINE =
  'Cinematic editorial photograph, Native Hawaiian or Polynesian subject in a wellness setting in Hawaii, soft natural light, muted teal and warm amber colour grade, premium wellness brand photography, photoreal, 35mm, high detail. No text overlay.'

const SYSTEM_PROMPT = `You decide what photo each slide in an HWC Instagram carousel should show. The clinic's photographic look is editorial wellness — real human subjects, soft daylight, warm Hawaii palette. NEVER inventory props that aren't visible in the script. Avoid stock-cliche subjects (handshake, lab coat pointing, generic pills bottle).

You receive a finished PostPlan (cover + body slides + cta) and emit a photo_brief array, one entry per slide.

For each slide pick exactly one source:
  • "ai"        — generate via Replicate Flux. Use for cover (hero) and high-impact body slides. Requires "prompt".
  • "drive"     — use a real photo from the clinic's Google Drive folder (matched by category later). Use when the slide topic maps cleanly to existing library (peptides, exosomes, neuropathy, etc). Requires "keywords" used as a hint.
  • "stock"     — Unsplash fallback. Use when subject is generic enough that real photo > AI. Requires "keywords".
  • "fallback"  — no photo, brand surface only. Use for the CTA slide and prose-only slides (analogy / "Think of it this way").

Rules:
  • Cover (n=1): almost always "ai" unless the topic is so specific (a particular protocol) that Drive has the right file. Subject should be a single human in a wellness setting, not a product shot.
  • Body slides: prefer "drive" when the heading references a body system / protocol with photos already shot. "ai" when the slide needs an emotionally specific moment.
  • Analogy / gap slides (no bullets, prose only): "fallback" — the prose carries it.
  • CTA: always "fallback".
  • For "ai" entries the "prompt" field must START with the subject sentence and then include the style line verbatim — do NOT rewrite the style line, append it as-is. The style line is: "${STYLE_LINE}"

Respond with ONLY valid JSON, no markdown fences:
{
  "photo_brief": [
    { "n": 1, "source": "ai", "subject": "...", "prompt": "<subject>. ${STYLE_LINE}", "keywords": null },
    { "n": 2, "source": "drive", "subject": "...", "prompt": null, "keywords": ["..."] },
    { "n": 7, "source": "fallback", "subject": "CTA stack — no photo", "prompt": null, "keywords": null }
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
      model: MODEL_HAIKU,
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

  // Body slides
  for (const slide of params.slides) {
    const found = briefs.find((b) => b?.n === slide.n)
    const heuristic =
      !slide.bullets || slide.bullets.length === 0
        ? { source: 'fallback' as const, subject: slide.heading ?? 'Prose slide — no photo' }
        : { source: 'drive' as const, subject: slide.heading ?? slide.intro ?? 'Clinic photo' }
    normalized.push(normaliseBrief(found, slide.n, heuristic))
  }

  // CTA slide — always fallback
  const ctaN = params.slides.length + 2
  normalized.push({
    n: ctaN,
    source: 'fallback',
    subject: 'CTA stack — no photo',
    prompt: null,
    keywords: null,
  })

  return normalized
}

function normaliseBrief(
  raw: Partial<PostPlanPhotoBrief> | undefined,
  n: number,
  fallback: { source: 'ai' | 'drive' | 'stock' | 'fallback'; subject: string }
): PostPlanPhotoBrief {
  const source: 'ai' | 'drive' | 'stock' | 'fallback' =
    raw?.source === 'ai' ||
    raw?.source === 'drive' ||
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
        : `${subject}. ${STYLE_LINE}`
      : null
  const keywords =
    source === 'stock' || source === 'drive'
      ? Array.isArray(raw?.keywords)
        ? raw!.keywords!.filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
        : null
      : null
  return { n, source, subject, prompt, keywords }
}
