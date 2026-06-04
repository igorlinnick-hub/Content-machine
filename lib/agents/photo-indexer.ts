import { MODEL_HAIKU, callAgentVisionJSON, type VisionImageInput } from './base'

// Vision-based photo description agent. For each image in a Drive folder
// we ask Haiku to extract:
//   - description: 1-2 short sentences capturing what the photo shows
//                  (subject, setting, mood, framing). Goes into matcher
//                  candidate context.
//   - tags: 3-7 short keywords for fuzzy / fallback ranking.
//
// Tone is descriptive, not interpretive — we want the matcher (text-LLM)
// to do the slide-context fit. So we suppress branding/aesthetic claims
// and focus on concrete visual facts.

const SYSTEM_PROMPT = `You are a visual catalogue assistant for a regenerative medicine clinic's content library. You will receive ONE photograph.

Your job: produce a short, factual description so a downstream text agent can match this photo to a relevant social-media slide.

Rules:
- DESCRIBE what is in the photo. Do not interpret meaning, brand, or audience.
- Mention concrete subjects (person, body part, equipment, room), setting (clinic, outdoor, studio), composition (close-up, wide, top-down), and mood ONLY when visually obvious (bright, dim, clinical, warm).
- Skip aesthetic / marketing language ("powerful", "inviting", "premium").
- No medical claims, no diagnoses.
- If the photo is abstract / decorative (texture, gradient, pattern), describe it as such.

Respond with ONLY valid JSON, no markdown fences, no commentary:
{
  "description": "1-2 short sentences. Plain English. <= 30 words.",
  "tags": ["tag1", "tag2", "..."]  // 3-7 lowercase keywords, single words or short phrases
}`

export interface IndexPhotoInput {
  image: VisionImageInput
}

export interface IndexPhotoOutput {
  description: string
  tags: string[]
  model: string
}

export async function runPhotoIndexer(
  input: IndexPhotoInput
): Promise<IndexPhotoOutput> {
  const raw = await callAgentVisionJSON<{ description: string; tags: string[] }>({
    model: MODEL_HAIKU,
    systemPrompt: SYSTEM_PROMPT,
    cacheSystem: true,
    userText: 'Describe this photo per the rules.',
    images: [input.image],
    maxTokens: 512,
  })

  const description = (raw.description ?? '').trim()
  if (!description) {
    throw new Error('photo-indexer: empty description from model')
  }
  const tags = Array.isArray(raw.tags)
    ? raw.tags
        .map((t) => (typeof t === 'string' ? t.trim().toLowerCase() : ''))
        .filter((t) => t.length > 0)
        .slice(0, 10)
    : []

  return { description, tags, model: MODEL_HAIKU }
}
