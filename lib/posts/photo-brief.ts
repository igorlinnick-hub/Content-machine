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

const SYSTEM_PROMPT = `You decide what photo each slide in an HWC Instagram carousel should show. The clinic's photographic look is editorial wellness — real human subjects, soft daylight, warm Hawaii palette.

CRITICAL RULE: Every subject and prompt MUST specifically reference the treatment, condition, or mechanism named in that slide's heading. Generic descriptions like "HWC patient wellness moment" or "doctor and patient talking" are WRONG. If the slide heading says "TMS Targets the Default Mode Network" the photo must show TMS equipment or a brain stimulation context — NOT a generic doctor visit.

You receive a finished PostPlan (cover + body slides + cta) and emit a photo_brief array, one entry per slide.

SOURCE DECISION (pick exactly one per slide):
  • "ai"       — Replicate Flux. Use for: cover hero, slides about emotion/lifestyle/recovery/confidence, doctor-patient moments, patient experience. Subject must be Native Hawaiian or Polynesian. NEVER use for equipment, devices, or clinical machinery (Flux hallucinates these badly).
  • "stock"    — Pexels/Unsplash. Use for: slides that name a specific device or procedure (TMS coil, PRP injection, IV drip, SGB needle, A2M injection, blood draw), biology/mechanism slides (blood cells, joints, brain scans), lab/clinical science.
  • "fallback" — no photo, brand surface only. Use for: analogy/"Think of it this way" prose slides (no bullets), CTA slide.

SPECIFICITY RULES:
  • Read the slide heading word-for-word. Extract the key treatment/condition/mechanism.
  • "ai" subject: name the specific moment (e.g. "Polynesian woman in her 40s experiencing relief from chronic joint pain, seated in a bright clinic room" NOT "wellness patient")
  • "stock" keywords: name the exact procedure or device (e.g. ["TMS machine", "transcranial magnetic stimulation coil", "brain stimulation"] NOT ["brain", "medical"])
  • If the slide is about peptides → stock keywords: ["peptide vials", "peptide injection", "bioregulator therapy"]
  • If the slide is about PRP → stock keywords: ["PRP injection knee", "platelet rich plasma", "joint injection"]
  • If the slide is about ketamine/Spravato → ai: patient in a calm infusion room setting
  • If the slide is about weight loss/GLP-1 → mix: lifestyle ai for patient story, stock for injection/medication

HARD RULES:
  • Cover (n=1): always "ai". Single human in a wellness setting related to the POST TOPIC, not generic.
  • Slides with no bullet points (analogy / "Think of it this way"): always "fallback".
  • CTA: always "fallback".
  • AI photo MUST have a dark lower third — the teal text panel overlays there. Include "dark lower third, subject in upper two-thirds of frame" in every ai prompt.
  • Never put clinical equipment (syringes, test tubes, lab coat, stethoscope) in an "ai" prompt — use "stock" for those.
  • Never use vague ai subjects: no "doctor and patient", "wellness moment", "healthy lifestyle". Always name the specific condition, treatment, or patient story from the slide.

The style line to append to EVERY ai prompt verbatim: "${STYLE_LINE}"

Respond with ONLY valid JSON, no markdown fences:
{
  "photo_brief": [
    { "n": 1, "source": "ai", "subject": "...", "prompt": "<specific subject sentence>. ${STYLE_LINE}", "keywords": null },
    { "n": 2, "source": "stock", "subject": "...", "prompt": null, "keywords": ["specific device", "specific procedure"] },
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

  // Body slides
  for (const slide of params.slides) {
    const found = briefs.find((b) => b?.n === slide.n)
    const heuristic =
      !slide.bullets || slide.bullets.length === 0
        ? { source: 'fallback' as const, subject: slide.heading ?? 'Prose slide — no photo' }
        : { source: 'ai' as const, subject: slide.heading ?? slide.intro ?? 'HWC patient wellness moment' }
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
        : `${subject}. ${STYLE_LINE}`
      : null
  const keywords =
    source === 'stock'
      ? Array.isArray(raw?.keywords)
        ? raw!.keywords!.filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
        : null
      : null
  return { n, source, subject, prompt, keywords }
}
