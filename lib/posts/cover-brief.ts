import { getStyleTemplate } from '@/lib/posts/style-templates'

// Give a photo-cover style a REAL cover photo (Igor 2026-08-20).
//
// The photo brief is written during generation, before a style is picked, so
// slide 1 is briefed `fallback` — "keep the template's branded surface". On
// Style 1 / 4 / Aesthetic the cover is a full-bleed photo, so "keep it" means
// keeping the DONOR post's photo: the same man walking into the same ocean on
// every post in that style. By the time /compose runs the style IS known, so
// this rewrites the cover entry into a real `ai` slide with an on-topic prompt.
//
// Style 2 / 3 covers are branded (no photo in the master) — untouched.

interface BriefEntry {
  n?: number
  source?: string
  subject?: string | null
  prompt?: string | null
  keywords?: string[] | null
  photo_url?: string | null
}

/** The house look, so a cover generated here matches the rest of the post. */
function coverPrompt(topic: string, hook: string | null): string {
  const subject = [topic, hook].filter(Boolean).join('. ')
  return `Editorial cover image for a medical carousel about: ${subject}. Clean, minimal, cinematic. EITHER a real Hawaii nature scene (ocean, reef, waterfall, rainforest foliage) OR a stylish 3D anatomical render of the exact organ / cell / molecule the topic is about — whichever fits the topic. Dark, muted teal and amber editorial palette, dark lower third so white text stays readable. No text, no logos, no watermarks, no lettering of any kind. If a person appears they must be seen from behind or at a distance, fully clothed, face never visible and never a close-up portrait.`
}

/**
 * Returns a patched `slides` JSON when the cover brief needs rewriting, or
 * null when nothing should change (branded-cover style, missing brief, or a
 * cover that already carries a real photo instruction).
 */
export function coverBriefForStyle(
  slides: unknown,
  styleId: number,
  topic: string,
  hook: string | null
): Record<string, unknown> | null {
  const style = getStyleTemplate(styleId)
  if (!style?.photoCover) return null

  const plan = slides as Record<string, unknown> | null
  const brief = plan?.photo_brief
  if (!Array.isArray(brief) || brief.length === 0) return null

  const idx = brief.findIndex((e: BriefEntry) => Number(e?.n) === 1)
  if (idx === -1) return null

  const entry = brief[idx] as BriefEntry
  // Only the "keep the branded surface" briefs need help. A cover already
  // briefed as ai / stock / clinic was written deliberately — leave it.
  if (entry.source !== 'fallback') return null

  const patched = [...brief]
  patched[idx] = {
    ...entry,
    source: 'ai',
    subject: `Cover — on-topic editorial image for "${topic}"`,
    prompt: coverPrompt(topic, hook),
  }
  return { ...(plan as Record<string, unknown>), photo_brief: patched }
}
