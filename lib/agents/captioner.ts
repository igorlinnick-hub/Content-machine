import { MODEL_HAIKU, callAgentJSON } from './base'
import { findClicheLines, findTeaserLines } from './teaser-lines'
import type { ClinicProfile } from '@/types'

// Captioner — Haiku 4.5 — turns the winning script into two
// platform-tuned captions:
//   - short: Reels/TikTok (1-2 sentences + up to 5 hashtags)
//   - long: Instagram carousel (3-5 sentences + CTA + up to 5 hashtags)
//
// We don't bake captions into the writer because (a) keeping the
// writer's output strictly script-shaped preserves the strong
// prompt cache hit, (b) running on Haiku separately is ~12× cheaper
// per token and the captioner is small.

const SYSTEM_PROMPT = `You are the captioner for a clinic's social posts.

INPUT: a doctor-voiced script (already written), the post topic, and the clinic profile.

OUTPUT: two captions in the same voice:
  - short_caption: Reels / TikTok / YouTube Shorts. 1-2 sentences MAX. Hook the scroll. End with 3-5 relevant hashtags. No emoji unless one fits naturally and the doctor's voice is OK with it.
  - long_caption: Instagram carousel post. 3-5 sentences. Same hook angle as short, but room for one concrete fact + one soft CTA ("Book a consult", "DM us", "Link in bio"). Hashtags at the end (3-5).

HARD RULES:
- Same TOPIC and ANGLE as the script. Don't drift.
- Same VOICE. If the script says "Most people miss…", the caption should sound like the same person.
- No medical promises ("cures", "guaranteed", "100%"). Mirror the script's hedging.
- No engagement-bait questions ("Comment YES if…", "Tag a friend who…"). Doctor voice, not influencer voice.
- Never invent statistics that aren't in the script.
- No clichés or AI tells — a calm doctor, not ad copy: no "X isn't just A — it's B" / "It's not X, it's Y", no "Here's why…" / "The truth is", no "Whether you're X or Y", "That's where X comes in", "Say goodbye to", "The result? …", no filler ("game-changer", "unlock", "journey", "dive in", "delve", "seamless", "cutting-edge", "transformative", "leverage", "holistic", "empower"). Say the concrete thing.
- Hashtags: lowercase, no spaces, no special chars. Mix general (#mentalhealth) with niche (#tmstherapy).
- NEVER more than 5 hashtags in a caption (Igor 2026-08-31). Five chosen ones read like a clinic; a wall of twelve reads like an account farming reach. Anything past the fifth is cut in code, so a sixth is a wasted slot, not a bonus.

Respond with ONLY valid JSON, no markdown fences:
{
  "short_caption": "...",
  "long_caption": "..."
}`

export interface RunCaptionerParams {
  topic: string
  hook: string
  script: string
  clinic: ClinicProfile
}

export interface CaptionerOutput {
  short_caption: string
  long_caption: string
}

export const MAX_HASHTAGS = 5

/**
 * Keep at most MAX_HASHTAGS hashtags, drop the rest (Igor 2026-08-31).
 *
 * The prompt says five, but the model drifts to eight or twelve the moment a
 * topic has many obvious tags, so the cap is enforced here too. The FIRST five
 * survive — the model puts the most relevant ones first — and the leftover
 * spacing is tidied so a trimmed tail doesn't leave a ragged line.
 */
export function capHashtags(text: string, max: number = MAX_HASHTAGS): string {
  let seen = 0
  const trimmed = text.replace(/#[A-Za-z0-9_]+/g, (tag) => {
    seen += 1
    return seen <= max ? tag : ''
  })
  if (seen <= max) return text
  return trimmed
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function runCaptioner(
  params: RunCaptionerParams
): Promise<CaptionerOutput> {
  const userContent = `Clinic: ${params.clinic.name} (${params.clinic.tone} tone)
${params.clinic.audience ? `Audience: ${params.clinic.audience}` : ''}
${params.clinic.services?.length ? `Services: ${params.clinic.services.join(', ')}` : ''}

POST TOPIC: ${params.topic}
HOOK: ${params.hook}

SCRIPT:
${params.script}

Now generate the two captions.`

  const call = (content: string) =>
    callAgentJSON<CaptionerOutput>({
      model: MODEL_HAIKU,
      systemPrompt: SYSTEM_PROMPT,
      userContent: content,
      maxTokens: 600,
      cacheSystem: true,
    })

  // Same cliché scan the Critic uses on scripts (2026-10-07: "isn't just X —
  // it's Y" kept shipping in captions). One retry with the hits quoted; keep
  // whichever pass has fewer, so a bad retry can never make it worse.
  let out = await call(userContent)
  const hitsIn = (o: CaptionerOutput) => {
    const text = `${o.short_caption ?? ''}\n${o.long_caption ?? ''}`
    return [...findTeaserLines(text), ...findClicheLines(text)]
  }
  const hits = hitsIn(out)
  if (hits.length) {
    try {
      const retry = await call(
        `${userContent}\n\nA previous attempt used these banned lines — rewrite without them, saying the concrete thing instead:\n${hits.map((h) => `  • "${h}"`).join('\n')}`
      )
      if (hitsIn(retry).length < hits.length) out = retry
    } catch {
      // keep the first pass
    }
  }

  return {
    short_caption: capHashtags(out.short_caption ?? ''),
    long_caption: capHashtags(out.long_caption ?? ''),
  }
}
