import { MODEL_HAIKU, callAgentJSON } from '@/lib/agents/base'
import type { TypedSlide } from '@/types'

// Visual module owns its own Claude call (does not import writer.ts) — only
// shares the base client. Splitter produces TYPED slides matching the HWC
// reference layout system: cover / body / cta. Runs on Haiku — narrow,
// well-scoped task where the smaller model performs the same and costs
// roughly 1/12 of Sonnet on input.
const SYSTEM_PROMPT = `You convert a 90-second video script into an Instagram carousel of 5 or 6 typed slides.

Slide kinds and required fields:

"cover" — EXACTLY ONE. Always slide 1. White-bg headline slide.
  • chip — REQUIRED. ALL CAPS eyebrow tag, 1 to 3 words. Names the topic category. Examples: "MYTHS", "DIAGNOSIS", "STEM CELLS", "WEIGHT LOSS", "MENTAL HEALTH", "RECOVERY", "PEPTIDES".
  • text — REQUIRED. ALL CAPS headline, 2 to 4 words, the topic itself. Examples: "KETAMINE THERAPY", "STEM CELL TRUTH", "GLP-1 REALITY CHECK".
  • subtext — REQUIRED. ONE sentence, max 12 words. Frames what the carousel reveals or argues.

"body" — 3 OR 4 of these between cover and CTA. Each one carries ONE beat from the script.
  • chip — REQUIRED. Title Case tag, max 4 words. Examples: "Myth 1", "The Science", "What This Means", "Step 2", "The Reality", "How It Works".
  • subtext — REQUIRED. ONE short sentence, max 14 words. The claim being addressed, the question, or the quote. Reads like a quote or sub-claim.
  • text — REQUIRED. ALL CAPS body, 2 to 4 sentences. The actual idea, evidence, or rebuttal.

"cta" — EXACTLY ONE. Always the last slide.
  • chip — REQUIRED. ALL CAPS headline. Examples: "STILL HAVE QUESTIONS?", "READY TO START?", "WANT THE NEXT STEP?".
  • subtext — REQUIRED. ONE sentence, max 14 words. Connects to the audience. Example: "SO DOES EVERYONE — THAT'S WHAT WE'RE HERE FOR."
  • text — REQUIRED. ALL CAPS action line ending with a clear call. Example: "BOOK A CONSULTATION — LINK IN BIO."

Counts: 5 or 6 total. Cover + 3 bodies + CTA = 5. Cover + 4 bodies + CTA = 6.

Hard rules:
- ALL THREE FIELDS (chip / text / subtext) ARE REQUIRED on EVERY slide. Never return null or empty.
- Do not invent facts not present in the script. Compress and re-frame.
- No emoji. No hashtags. No markdown.
- ALL CAPS where specified above (cover chip + headline, body text, CTA chip + text). Title Case for body chip. Sentence case OK for cover subtext, body subtext, CTA subtext.
- Keep each visible string short — slides must read in under 3 seconds.

Respond with ONLY valid JSON, no markdown fences, no commentary:
{
  "slides": [
    { "kind": "cover", "chip": "MYTHS", "text": "KETAMINE THERAPY", "subtext": "Cover everything you've heard about ketamine therapy is probably wrong." },
    { "kind": "body",  "chip": "Myth 1", "subtext": "It's just a party drug.", "text": "KETAMINE HAS BEEN USED AS A CONTROLLED ANESTHETIC IN CLINICAL SETTINGS SINCE 1970..." },
    { "kind": "body",  "chip": "Myth 2", "subtext": "It only treats severe depression.", "text": "..." },
    { "kind": "body",  "chip": "Myth 3", "subtext": "The effects do not last.", "text": "..." },
    { "kind": "cta",   "chip": "STILL HAVE QUESTIONS?", "subtext": "So does everyone — that's what we're here for.", "text": "BOOK A CONSULTATION — LINK IN BIO." }
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
    model: MODEL_HAIKU,
    systemPrompt: SYSTEM_PROMPT,
    userContent: `Script:\n\n${script}\n\nSplit into typed slides now. Every slide must have chip + text + subtext. Return only the JSON.`,
    maxTokens: 4096,
    cacheSystem: true,
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
