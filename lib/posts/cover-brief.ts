import { getNicheProfile } from '@/lib/niche/profiles'
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

/**
 * The house look, so a cover generated here matches the rest of the post.
 * Per niche (v4.1, Igor 2026-08-26): regenmed keeps the render / Hawaii
 * cover; aesthetics gets the beauty-editorial one — real skin cropped so no
 * face can appear, a still-life instrument, or an empty treatment room — in
 * the warm-neutral / lavender grade of the Aesthetic master.
 */
function coverPrompt(topic: string, hook: string | null, niche: string | null | undefined): string {
  if (getNicheProfile(niche).id === 'aesthetics') return aestheticsCoverPrompt(topic, hook)
  const subject = [topic, hook].filter(Boolean).join('. ')
  return `Editorial cover image for a medical carousel about: ${subject}. Clean, minimal, cinematic. EITHER a real Hawaii nature scene (ocean, reef, waterfall, rainforest foliage) OR a stylish 3D anatomical render of the exact organ / cell / molecule the topic is about — whichever fits the topic. Dark, muted teal and amber editorial palette, dark lower third so white text stays readable. No text, no logos, no watermarks, no lettering of any kind. If a person appears they must be seen from behind or at a distance, fully clothed, face never visible and never a close-up portrait.`
}

// Aesthetics cover — the scene is chosen HERE, by topic keywords, and the
// topic text itself never reaches Flux. Tested 2026-08-26: a free prompt
// ("still life OR room OR skin, whichever fits: Botox for forehead lines —
// what happens at the appointment") came back as a full AI face with a
// syringe at the eye. Given a choice and a topic, Flux draws the procedure.
function aestheticsCoverPrompt(topic: string, hook: string | null): string {
  const t = `${topic} ${hook ?? ''}`.toLowerCase()
  const instrument = instrumentForTopic(t)
  const faceWords =
    /\b(forehead|brows?|eyes?|under-eye|crow'?s|lips?|cheeks?|chin|jaw|jawline|jowls?|face|facial|smile|frown|11s)\b/.test(
      t
    )
  const bodySkinWords =
    /\b(neck|hands?|d[ée]collet[ée]|chest|arms?|body|texture|hydration|dry skin|pores|crepe|sun ?spots?|collagen|glow|elastin)\b/.test(
      t
    )
  const visitWords =
    /\b(appointment|visit|consult|consultation|what to expect|first time|pricing|cost|price|downtime|aftercare|recovery)\b/.test(
      t
    )

  let scene: string
  if (!instrument && visitWords) {
    scene =
      'a calm, empty medical-aesthetics treatment room in soft morning light: a treatment bed with clean white linen, a ring light, a rolling tray with sealed sterile packs, a shelf of unlabelled skincare bottles, sheer curtains, a plant'
  } else if (!instrument && bodySkinWords && !faceWords) {
    // ONE concrete scene, not a list of options: offered "neck OR shoulder OR
    // hand", Flux picked an ambiguous cheek-to-jaw crop with waxy skin. The
    // neck-from-behind sentence is the one that passed review (2026-08-26).
    scene =
      'an extreme close-up of the side and nape of the neck seen from directly behind, hair tucked up, the head turned away and cropped out of frame above the hairline; natural skin with fine visible pores and soft dewy highlights, matte-real texture, not plastic; no face, no jaw, no chin, no ear in profile'
  } else {
    scene = `a still life of ${instrument ?? 'a glass serum dropper and unlabelled glass vials'} resting on pale stone or satin, with folded cotton pads beside it`
  }
  // Never say "magazine cover" here — Flux then renders a literal VOGUE
  // front page with masthead and headlines baked in (tested 2026-08-26).
  return `Full-bleed beauty-editorial photograph, a REAL photograph of ${scene}. Soft diffused light, warm neutral palette with a gentle lavender-mauve tint, shallow depth of field, calm dark lower half where nothing sits. No people, no hands, no faces, no eyes, no nose, no lips, no needle entering skin, no blood, not a 3D render, not an abstract texture. Absolutely no text, no typography, no headlines, no masthead, no labels, no brand names, no logos, no watermarks, no lettering of any kind — a plain photograph only.`
}

/** The instrument a treatment topic names, or null when it names none. */
function instrumentForTopic(t: string): string | null {
  if (/\b(microneedl\w*|prp|vampire|collagen induction)\b/.test(t)) return 'a microneedling pen'
  if (/\b(laser|ipl|bbl|radiofrequency|rf|morpheus|ultherapy|ultrasound|led)\b/.test(t)) {
    return 'a laser handpiece'
  }
  if (/\b(peels?|chemical|acid|exfoliat\w*)\b/.test(t)) return 'a glass dropper bottle'
  if (/\b(spf|sunscreen|skincare|routine|serums?|retinol|moisturi[sz]\w*)\b/.test(t)) {
    return 'an unlabelled SPF bottle and a glass serum dropper'
  }
  if (/\b(fillers?|lips?|cheeks?|chin|jaw|jawline|volume|hyaluronic|juvederm|restylane)\b/.test(t)) {
    return 'a syringe of clear gel beside a blunt-tip cannula'
  }
  // Drug names and face-only regions; NOT "lines"/"wrinkles" — "neck lines" is a
  // skin cover, not a syringe.
  if (/\b(botox|dysport|xeomin|tox|neuromodulator|forehead|11s|crow'?s|brows?)\b/.test(t)) {
    return 'a fine-gauge syringe of clear liquid beside a small unlabelled glass vial'
  }
  return null
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
  hook: string | null,
  /** `clinics.niche` — picks the cover doctrine. Null/unknown → regenmed. */
  niche: string | null | undefined = null
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
    prompt: coverPrompt(topic, hook, niche),
  }
  return { ...(plan as Record<string, unknown>), photo_brief: patched }
}
