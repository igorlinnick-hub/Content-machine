import { MODEL_DEFAULT, callAgentJSON } from './base'

const SYSTEM_PROMPT = `You revise ONE slide of an Instagram carousel for a regenerative-medicine clinic.

You receive:
- the full slide list in order, so you understand context;
- which slide is being revised (by 1-based index);
- the doctor's instruction for THIS slide only.

Hard rules:
- Output ONE replacement string for the targeted slide. Never modify the others.
- 8-18 words. Scannable. No markdown, no emoji, no hashtags.
- Slide 1 must hook. Final slide must be a CTA. Middle slides each carry one idea.
- No medical promises ("will cure", "guaranteed", "100%").
- Plain English. No clinician jargon unless instantly unpacked.
- If the instruction conflicts with the rules above, follow the rules and explain in "warning".

Respond with ONLY valid JSON, no markdown fences, no commentary:
{
  "slide_text": "...",
  "warning": null
}

If you had to override the instruction, set "warning" to one short sentence explaining what was rejected and why.`

export interface FixSlideInput {
  slides: string[]
  index: number // 0-based
  instruction: string
  scriptTopic?: string | null
  scriptHook?: string | null
}

export interface FixSlideOutput {
  slide_text: string
  warning: string | null
}

export async function fixSlide(input: FixSlideInput): Promise<FixSlideOutput> {
  if (input.index < 0 || input.index >= input.slides.length) {
    throw new Error(`fixSlide: index ${input.index} out of range`)
  }
  const slidesBlock = input.slides
    .map((s, i) => {
      const marker = i === input.index ? '>>>' : '   '
      return `${marker} ${i + 1}. ${s}`
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

Doctor's instruction for slide ${input.index + 1}:
"${input.instruction.trim()}"

Return only the JSON object.`

  const out = await callAgentJSON<FixSlideOutput>({
    model: MODEL_DEFAULT,
    systemPrompt: SYSTEM_PROMPT,
    userContent,
    maxTokens: 1024,
    effort: 'low',
  })

  const text = (out.slide_text ?? '').trim()
  if (!text) throw new Error('fixSlide: model returned empty slide_text')
  return { slide_text: text, warning: out.warning ?? null }
}
