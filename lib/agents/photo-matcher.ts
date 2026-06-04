import { MODEL_HAIKU, callAgentJSON } from './base'

// Slide → photo recommender. Receives the slide context (chip, body
// text, kind) and the indexed photo catalog (description + tags). Asks
// the model to rank the top N candidates and explain the fit in one
// short clause per pick. We deliberately stay text-only here — the
// vision pass already happened at index time, so this call is fast and
// cheap (Haiku).
//
// Output shape is small: [{ drive_file_id, score, reason }], top-N only.

const SYSTEM_PROMPT = `You are a photo curator for an Instagram-style social post. You receive:
- ONE slide context (a chip / headline + body text)
- A catalog of available photos (drive_file_id + 1-2 sentence description)
- An "already_used" list of drive_file_id strings already assigned to OTHER slides in the same post — NEVER include any of these in your picks (the team wants visual variety across the carousel).

Rank the remaining photos by how well they fit the slide. Bias toward:
- subject match (a slide about "magnetic stimulation" should prefer photos that show TMS equipment, scalp coils, brain models — not unrelated stock)
- mood match (a "still have questions" CTA should prefer warmer / face-to-face photos)
- specificity (a slide that names a body part or procedure prefers a photo that shows it concretely)

Avoid:
- generic stock when a specific match exists
- photos that visually contradict the slide claim
- anything whose drive_file_id appears in already_used

Respond with ONLY valid JSON, no markdown fences, no commentary:
{
  "picks": [
    { "drive_file_id": "...", "score": 0.0, "reason": "short clause why" }
    // up to N items, score 0..1, ordered best-first
  ]
}

If no photo in the catalog meaningfully fits (or every fit is already used), return picks: [].`

export interface PhotoCandidate {
  drive_file_id: string
  description: string
  tags?: string[]
}

export interface MatchPhotoToSlideInput {
  // Slide we are picking a photo for.
  slide: {
    kind: 'cover' | 'body' | 'cta'
    chip: string | null
    text: string
    subtext: string | null
  }
  // Optional script-level context (topic / hook) so matcher understands
  // the post theme beyond the single slide.
  postContext?: { topic?: string | null; hook?: string | null } | null
  // Indexed photo catalog from the same Drive folder.
  candidates: PhotoCandidate[]
  // How many picks to return. Defaults to 5.
  topN?: number
  // Drive file IDs already assigned to OTHER slides in the same post.
  // Matcher excludes them so the carousel doesn't dup photos. Hard
  // filter on top of the LLM's bias — defence-in-depth.
  excludeFileIds?: string[]
}

export interface MatchPick {
  drive_file_id: string
  score: number
  reason: string
}

export interface MatchPhotoToSlideOutput {
  picks: MatchPick[]
  model: string
}

export async function runPhotoMatcher(
  input: MatchPhotoToSlideInput
): Promise<MatchPhotoToSlideOutput> {
  const topN = Math.max(1, Math.min(input.topN ?? 5, 10))
  if (input.candidates.length === 0) {
    return { picks: [], model: MODEL_HAIKU }
  }

  // Hard filter exclusions before we ever hit the LLM — protects against
  // a model that ignores the system-prompt rule. Soft filter (system
  // prompt) covers semantic dup ("close-up of the same room"); hard
  // filter covers exact dup ("same drive_file_id").
  const excluded = new Set(input.excludeFileIds ?? [])
  const filtered = input.candidates.filter(
    (c) => !excluded.has(c.drive_file_id)
  )
  if (filtered.length === 0) {
    return { picks: [], model: MODEL_HAIKU }
  }

  // Trim catalog to a reasonable upper bound. Past ~50 photos the prompt
  // grows linearly and the matcher gets distracted; tier-2 (see
  // memory/project_photo_scale_strategy) introduces tag-overlap pre-rank
  // when folders cross this threshold.
  const catalog = filtered.slice(0, 50).map((c) => ({
    drive_file_id: c.drive_file_id,
    description: c.description,
    tags: (c.tags ?? []).slice(0, 6),
  }))

  const userPayload = {
    slide: input.slide,
    post_context: input.postContext ?? null,
    top_n: topN,
    catalog,
    already_used: input.excludeFileIds ?? [],
  }

  const raw = await callAgentJSON<{ picks: MatchPick[] }>({
    model: MODEL_HAIKU,
    systemPrompt: SYSTEM_PROMPT,
    cacheSystem: true,
    userContent: JSON.stringify(userPayload),
    maxTokens: 1024,
  })

  const picks: MatchPick[] = Array.isArray(raw.picks)
    ? raw.picks
        .filter(
          (p): p is MatchPick =>
            !!p &&
            typeof p.drive_file_id === 'string' &&
            typeof p.score === 'number' &&
            typeof p.reason === 'string' &&
            !excluded.has(p.drive_file_id)
        )
        .slice(0, topN)
    : []

  return { picks, model: MODEL_HAIKU }
}
