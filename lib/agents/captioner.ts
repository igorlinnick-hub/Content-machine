import { MODEL_HAIKU, callAgentJSON } from './base'
import type { ClinicProfile } from '@/types'

// Captioner — Haiku 4.5 — turns the winning script into two
// platform-tuned captions:
//   - short: Reels/TikTok (1-2 sentences + 3-5 hashtags)
//   - long: Instagram carousel (3-5 sentences + CTA + hashtags)
//
// We don't bake captions into the writer because (a) keeping the
// writer's output strictly script-shaped preserves the strong
// prompt cache hit, (b) running on Haiku separately is ~12× cheaper
// per token and the captioner is small.

const SYSTEM_PROMPT = `You are the captioner for a clinic's social posts.

INPUT: a doctor-voiced script (already written), the post topic, and the clinic profile.

OUTPUT: two captions in the same voice:
  - short_caption: Reels / TikTok / YouTube Shorts. 1-2 sentences MAX. Hook the scroll. End with 3-5 relevant hashtags. No emoji unless one fits naturally and the doctor's voice is OK with it.
  - long_caption: Instagram carousel post. 3-5 sentences. Same hook angle as short, but room for one concrete fact + one soft CTA ("Book a consult", "DM us", "Link in bio"). Hashtags at the end (3-7).

HARD RULES:
- Same TOPIC and ANGLE as the script. Don't drift.
- Same VOICE. If the script says "Most people miss…", the caption should sound like the same person.
- No medical promises ("cures", "guaranteed", "100%"). Mirror the script's hedging.
- No engagement-bait questions ("Comment YES if…", "Tag a friend who…"). Doctor voice, not influencer voice.
- Never invent statistics that aren't in the script.
- Hashtags: lowercase, no spaces, no special chars. Mix general (#mentalhealth) with niche (#tmstherapy).

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

  return callAgentJSON<CaptionerOutput>({
    model: MODEL_HAIKU,
    systemPrompt: SYSTEM_PROMPT,
    userContent,
    maxTokens: 600,
    cacheSystem: true,
  })
}
