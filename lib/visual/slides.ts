import { MODEL_DEFAULT, callAgentJSON } from '@/lib/agents/base'
import type { TypedSlide } from '@/types'

// Visual module owns its own Claude call (does not import writer.ts) — only
// shares the base client. Splitter now produces TYPED slides matching the
// HWC reference layout system: cover / body / cta.
const SYSTEM_PROMPT = `You convert a 90-second video script into an Instagram carousel of 5-6 typed slides.

Slide kinds:
- "cover" — exactly ONE, always slide 1. White-bg headline slide.
  - chip: short eyebrow tag in ALL CAPS (the topic category as one word, e.g. "MYTHS", "DIAGNOSIS", "TREATMENT", "WEIGHT", "RECOVERY"). No emoji.
  - text: 2-4 word ALL CAPS headline that names the topic (e.g. "KETAMINE THERAPY", "STEM CELLS", "GLP-1 REALITY CHECK").
  - subtext: ONE short sentence (max 12 words) framing the post — what the carousel reveals or argues.
- "body" — 3-4 of these between cover and CTA. Each carries one beat.
  - chip: short tag (e.g. "Myth 1", "The Science", "What This Means", "Step 2"). Title case, max 4 words.
  - subtext: a single sentence in italics — the claim or quote being addressed (max 14 words). Optional.
  - text: the body card content. ALL CAPS. 2-4 sentences. The actual idea or rebuttal.
- "cta" — exactly ONE, always the last slide.
  - chip: punchy headline ALL CAPS (e.g. "STILL HAVE QUESTIONS?", "READY TO START?").
  - subtext: ONE sentence connecting to the audience (max 14 words) — what the team is here for.
  - text: ALL CAPS action line ending with a clear call (e.g. "BOOK A CONSULTATION — LINK IN BIO.").

Total: 5 or 6 slides. Cover + 3 or 4 bodies + cta.

Hard rules:
- Do not invent facts not present in the script. Compress and re-frame.
- No emoji. No hashtags. No markdown. ALL CAPS only where specified above.
- Keep each visible string short — slides must read in under 3 seconds.
- "subtext" is optional on body slides only. Always present on cover and cta.

Respond with ONLY valid JSON, no markdown fences:
{
  "slides": [
    { "kind": "cover", "chip": "...", "text": "...", "subtext": "..." },
    { "kind": "body",  "chip": "...", "text": "...", "subtext": "..." },
    { "kind": "body",  "chip": "...", "text": "..." },
    { "kind": "body",  "chip": "...", "text": "..." },
    { "kind": "cta",   "chip": "...", "text": "...", "subtext": "..." }
  ]
}`

export interface SplitScriptToSlidesResult {
  slides: TypedSlide[]
}

export async function splitScriptToSlides(
  script: string
): Promise<SplitScriptToSlidesResult> {
  if (!script.trim()) throw new Error('splitScriptToSlides: script is empty')

  const out = await callAgentJSON<{ slides: Array<Partial<TypedSlide>> }>({
    model: MODEL_DEFAULT,
    systemPrompt: SYSTEM_PROMPT,
    userContent: `Script:\n\n${script}\n\nSplit into typed slides now. Return only the JSON.`,
    maxTokens: 4096,
    effort: 'low',
  })

  const slides = (out.slides ?? [])
    .map((s): TypedSlide | null => {
      if (!s || typeof s !== 'object') return null
      const kind = s.kind === 'cover' || s.kind === 'cta' ? s.kind : 'body'
      const text = (s.text ?? '').trim()
      if (!text) return null
      return {
        kind,
        text,
        chip: s.chip?.trim() || null,
        subtext: s.subtext?.trim() || null,
      }
    })
    .filter((s): s is TypedSlide => s !== null)

  if (slides.length < 3) {
    throw new Error(
      `splitScriptToSlides: model returned only ${slides.length} usable slides — need at least 3`
    )
  }

  // Defensive: enforce one cover at index 0, one cta at last; coerce any
  // misplaced kinds to body.
  const fixed: TypedSlide[] = slides.map((s, i, arr) => {
    if (i === 0) return { ...s, kind: 'cover' }
    if (i === arr.length - 1) return { ...s, kind: 'cta' }
    return { ...s, kind: 'body' }
  })

  return { slides: fixed.slice(0, 6) }
}
