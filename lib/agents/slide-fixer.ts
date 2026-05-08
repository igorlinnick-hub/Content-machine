import { MODEL_HAIKU, callAgentJSON } from './base'
import type { TypedSlide, SlideKind } from '@/types'

const SYSTEM_PROMPT = `You revise ONE slide of a typed Instagram carousel for a regenerative-medicine clinic.

Each slide has a "kind" (cover / body / cta) and three fields:
- chip: short eyebrow / chip / headline (always present on cover and cta; usually present on body).
- text: the main content of the slide.
- subtext: optional supporting line.

Rules per kind:
- cover: chip=ALL CAPS eyebrow (1-3 words). text=ALL CAPS headline (2-4 words, the topic). subtext=ONE short sentence (max 12 words) framing the post.
- body: chip=Title Case tag (max 4 words). subtext=optional italic claim/quote (max 14 words). text=ALL CAPS body, 2-4 sentences, the actual idea.
- cta: chip=ALL CAPS punchy headline. subtext=ONE sentence (max 14 words). text=ALL CAPS action line ending with a clear call.

You receive:
- the full slide list in order, so you understand context;
- which slide is being revised (by 1-based index, kind included);
- the doctor's instruction for THIS slide only.

Hard rules:
- Output ONE replacement object for the targeted slide. Never modify the others.
- Keep the same "kind" — do not change cover/body/cta unless the doctor explicitly asks.
- No medical promises ("will cure", "guaranteed", "100%").
- Plain English. No clinician jargon unless instantly unpacked.
- No emoji, no markdown, no hashtags.
- If the instruction conflicts with the rules above, follow the rules and explain in "warning".

Respond with ONLY valid JSON, no markdown fences, no commentary:
{
  "kind": "cover|body|cta",
  "chip": "..." | null,
  "text": "...",
  "subtext": "..." | null,
  "warning": null
}

If you had to override the instruction, set "warning" to one short sentence explaining what was rejected and why.`

export interface FixSlideInput {
  slides: TypedSlide[]
  index: number // 0-based
  instruction: string
  scriptTopic?: string | null
  scriptHook?: string | null
}

export interface FixSlideOutput {
  slide: TypedSlide
  warning: string | null
}

export async function fixSlide(input: FixSlideInput): Promise<FixSlideOutput> {
  if (input.index < 0 || input.index >= input.slides.length) {
    throw new Error(`fixSlide: index ${input.index} out of range`)
  }
  const slidesBlock = input.slides
    .map((s, i) => {
      const marker = i === input.index ? '>>>' : '   '
      const parts: string[] = [`${marker} ${i + 1}. [${s.kind}]`]
      if (s.chip) parts.push(`chip: ${s.chip}`)
      if (s.subtext) parts.push(`subtext: ${s.subtext}`)
      parts.push(`text: ${s.text}`)
      return parts.join('\n   ')
    })
    .join('\n')

  const ctxBlock = [
    input.scriptTopic ? `Topic: ${input.scriptTopic}` : null,
    input.scriptHook ? `Original hook: ${input.scriptHook}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const userContent = `${ctxBlock ? `${ctxBlock}\n\n` : ''}Slides (the targeted one is marked with >>>):
${slidesBlock}

Doctor's instruction for slide ${input.index + 1} (kind=${input.slides[input.index].kind}):
"${input.instruction.trim()}"

Return only the JSON object.`

  const out = await callAgentJSON<{
    kind?: string
    chip?: string | null
    text?: string
    subtext?: string | null
    warning?: string | null
  }>({
    model: MODEL_HAIKU,
    systemPrompt: SYSTEM_PROMPT,
    userContent,
    maxTokens: 1024,
    cacheSystem: true,
  })

  const text = (out.text ?? '').trim()
  if (!text) throw new Error('fixSlide: model returned empty text')
  const kindRaw = out.kind
  const fallbackKind = input.slides[input.index].kind
  const kind: SlideKind =
    kindRaw === 'cover' || kindRaw === 'body' || kindRaw === 'cta'
      ? kindRaw
      : fallbackKind

  return {
    slide: {
      kind,
      text,
      chip: out.chip?.trim() || null,
      subtext: out.subtext?.trim() || null,
    },
    warning: out.warning ?? null,
  }
}
