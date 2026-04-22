import { MODEL_DEFAULT, callAgentJSON } from '@/lib/agents/base'

// Visual module has its own Claude call — it does NOT import writer.ts.
// Shared infrastructure only (the base client).
const SYSTEM_PROMPT = `You split 90-second video scripts into Instagram carousel slides.

Rules:
- 5 to 7 slides total.
- Each slide is a short, scannable text block (max ~18 words, ideally 8-14).
- Slide 1 is the hook — a specific claim or question that makes someone stop.
- Middle slides each carry one idea or step, in the order the script presents it.
- The last slide is the call to action.
- Do not add content that was not in the script. Compress — do not invent.
- Do not use emoji. Do not use hashtags.

Respond with ONLY valid JSON, no markdown fences:
{
  "slides": ["...", "...", "..."]
}`

export interface SplitScriptToSlidesResult {
  slides: string[]
}

export async function splitScriptToSlides(
  script: string
): Promise<SplitScriptToSlidesResult> {
  if (!script.trim()) throw new Error('splitScriptToSlides: script is empty')

  const out = await callAgentJSON<SplitScriptToSlidesResult>({
    model: MODEL_DEFAULT,
    systemPrompt: SYSTEM_PROMPT,
    userContent: `Script:\n\n${script}\n\nSplit into slides now. Return only the JSON.`,
    maxTokens: 2048,
  })

  const slides = (out.slides ?? [])
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter((s) => s.length > 0)

  if (slides.length < 3) {
    throw new Error(
      `splitScriptToSlides: model returned only ${slides.length} slides — need at least 3`
    )
  }

  return { slides: slides.slice(0, 7) }
}
