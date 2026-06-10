import type { TypedSlide, VisualStyle } from '@/types'

// Pure function: turns a slide + brand context into a slide-aware Flux
// prompt. No I/O. Used by photoFiller before calling the generator.
//
// Design notes:
// - Bias hard against "doctor with clipboard" generic stock by routing
//   abstract concepts (cells, neurons, exosomes, peptides) through a
//   macro / 3D-render template instead of a portrait template.
// - Always block faces of identifiable people, text, logos, signage
//   so we never produce content that violates clinic compliance.
// - Brand palette hint nudges colour cohesion across the carousel
//   without locking the model to one tone (gives the generator room
//   to breathe while staying on-brand).

export interface BrandHint {
  primary?: string | null
  accent?: string | null
  paletteName?: string | null // e.g. "navy + sky"
  niche?: string | null       // e.g. "regenerative_medicine"
  clinicName?: string | null
}

// Words that trigger the abstract / macro template instead of the
// editorial / lifestyle one. Cheap heuristic, deterministic.
const ABSTRACT_KEYWORDS = [
  'cell', 'cells', 'exosome', 'exosomes', 'neuron', 'neurons', 'synapse',
  'peptide', 'peptides', 'mitochondria', 'dna', 'rna', 'protein',
  'molecule', 'stem cell', 'collagen', 'fibroblast', 'plasma', 'platelet',
  'inflammation', 'cytokine', 'antibody', 'mrna', 'lipid',
]

function isAbstract(text: string): boolean {
  const lower = text.toLowerCase()
  return ABSTRACT_KEYWORDS.some((k) => lower.includes(k))
}

function firstSentence(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  const m = trimmed.match(/^[^.!?\n]+[.!?]?/)
  return (m ? m[0] : trimmed).slice(0, 220).trim()
}

function paletteHint(brand: BrandHint, style: VisualStyle | null): string {
  if (brand.paletteName) return brand.paletteName
  const accent = brand.accent ?? style?.brand?.accent
  const primary = brand.primary ?? style?.brand?.primary
  if (accent && primary) return `${primary} and ${accent} tones`
  return 'cool clinical palette'
}

const HARD_CONSTRAINTS =
  'no text overlay, no logos, no signage, no watermarks, no UI elements, ' +
  'no faces of identifiable real people, no children, no medical brand names'

export interface SlidePromptInput {
  slide: TypedSlide
  brand: BrandHint
  style?: VisualStyle | null
  // Topic / hook from the script so the matcher doesn't tunnel-vision
  // on a single sentence.
  postContext?: { topic?: string | null; hook?: string | null } | null
}

// Build the Flux prompt for ONE slide. Returns a single string ready
// for `generateImages({ input: { prompt } })`.
export function buildSlidePhotoPrompt(input: SlidePromptInput): string {
  const { slide, brand, style, postContext } = input
  const subject = (slide.chip ?? '').trim()
  const body = firstSentence(slide.text)
  const topic = postContext?.topic?.trim() || ''
  const palette = paletteHint(brand, style ?? null)
  const niche = (brand.niche ?? 'regenerative medicine').replace(/_/g, ' ')

  // Combined source text used for abstract-vs-editorial decision.
  const decisionSource = [subject, body, topic].filter(Boolean).join(' ')
  const useAbstract = isAbstract(decisionSource)

  if (useAbstract) {
    return [
      `Macro scientific photograph for a ${niche} clinic social post.`,
      `Subject: ${subject || topic || 'cellular biology'} — ${body || topic}.`,
      `Style: stylized 3D render or macro photography, bioluminescent details,`,
      `soft glow, shallow depth of field, dark ${palette}, premium scientific aesthetic.`,
      `Composition: centred subject, abstract negative space, vertical 4:5 frame.`,
      `Strictly NO humans, NO doctors, NO clinical settings.`,
      `HARD CONSTRAINTS: ${HARD_CONSTRAINTS}.`,
    ].join(' ')
  }

  return [
    `Editorial wellness photograph for a ${niche} clinic social post.`,
    `Subject focus: ${subject || topic || 'wellness moment'} — ${body || topic}.`,
    `Style: soft natural light, shallow depth of field, ${palette},`,
    `premium clinic aesthetic, editorial composition, vertical 4:5 frame.`,
    `Avoid generic stock: no doctor-with-clipboard, no exam-room cliches.`,
    `HARD CONSTRAINTS: ${HARD_CONSTRAINTS}.`,
  ].join(' ')
}

// Deterministic hash for the cache key. Same slide subject + first
// sentence + niche → same hash → same filename in Drive → photoFiller
// reuses it instead of regenerating. SHA-256 truncated to 16 hex
// chars (collision risk negligible at our volumes).
export async function slidePromptCacheKey(
  input: SlidePromptInput
): Promise<string> {
  const subject = (input.slide.chip ?? '').trim().toLowerCase()
  const sentence = firstSentence(input.slide.text).toLowerCase()
  const niche = (input.brand.niche ?? '').toLowerCase()
  const seed = [subject, sentence, niche].join('|')
  const enc = new TextEncoder().encode(seed)
  const digest = await crypto.subtle.digest('SHA-256', enc)
  return Buffer.from(digest).toString('hex').slice(0, 16)
}
