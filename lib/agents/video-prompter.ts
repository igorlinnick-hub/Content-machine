import { MODEL_HAIKU, callAgentJSON } from './base'

// Turn a topic + optional script reference into a Seedance 2.0 prompt
// that produces a 5-10 second portrait B-roll clip suitable for medical
// clinic ads. The 15 Seedance skills installed at ~/.claude/skills/
// taught me the prompt grammar; this agent encodes it.
const SYSTEM_PROMPT = `You generate a Seedance 2.0 video prompt for a regenerative medicine clinic.

Output a single rich prompt (15-25 lines) that produces 5-10 seconds of cinematic B-roll. The prompt must be specific, mechanism-grounded, and fit a 9:16 portrait Instagram reel.

Required structure of the prompt body:

[Opening 2-second hook]
A sentence describing what the FIRST 2 seconds of the video must show — the strongest, scroll-stopping image. Concrete subject, concrete action.

[Subject and action]
2-3 sentences describing the main subject (a hand, an instrument, a glowing molecule, a patient profile silhouette, an MRI slice — never identifiable faces unless the brief explicitly says actor) and what they do across the clip.

[Camera]
2-3 sentences with the camera language. Use Seedance terms: "slow dolly in", "macro shot", "shallow depth of field", "anamorphic lens flare", "static lock-off", "85mm portrait crop", "handheld float", "Steadicam glide", "crash zoom", "rack focus".

[Lighting and atmosphere]
2 sentences. Examples: "soft clinical key light, cool 5600K", "single warm rim light from camera-left", "volumetric fog backlit", "high-key beauty lighting, white seamless".

[Colour and texture]
1-2 sentences. Examples: "neutral medical palette with one cobalt accent", "warm amber + steel cyan complementary", "matte film grain, subtle halation", "clean Apple-product look".

[End frame]
A sentence describing what the FINAL frame must look like.

[Forbidden]
A sentence of NO/NEGATIVE space: "no text overlays, no patient faces, no logos, no cartoon style, no jittery handheld".

Hard rules:
- No medical promises. No "cure", "guarantee", "100% effective". The clip is mood + mechanism, not a claim.
- Do not invent identifiable people. Use silhouettes, hands, profiles, instruments, abstract bio-imagery.
- Stay clinical / premium / calm — not gimmicky AI-slop.
- Prompt must be mechanism-grounded if the topic has mechanism (e.g. "stem cells releasing cytokines into damaged cartilage" not "magic healing").

Respond with ONLY valid JSON, no markdown fences, no commentary:
{
  "prompt": "...full multi-paragraph prompt as one string...",
  "duration_sec": 5,
  "aspect_ratio": "9:16",
  "negative": "no text overlays, no patient faces, no logos, no cartoon style"
}`

export interface VideoPrompterInput {
  topic: string
  script?: string | null
  category?: string | null
  durationSec?: 4 | 5 | 6 | 8 | 10
  aspectRatio?: '9:16' | '16:9' | '1:1' | '4:5'
}

export interface VideoPrompterOutput {
  prompt: string
  duration_sec: number
  aspect_ratio: string
  negative: string
}

export async function runVideoPrompter(
  input: VideoPrompterInput
): Promise<VideoPrompterOutput> {
  const userContent = `Topic: ${input.topic}
${input.category ? `Category: ${input.category}` : ''}
${input.script ? `\nScript reference (extract a specific visual beat from it):\n${input.script}\n` : ''}
Target duration: ${input.durationSec ?? 5}s
Target aspect: ${input.aspectRatio ?? '9:16'}

Generate the Seedance 2.0 prompt now. Return only the JSON object.`

  return callAgentJSON<VideoPrompterOutput>({
    model: MODEL_HAIKU,
    systemPrompt: SYSTEM_PROMPT,
    userContent,
    maxTokens: 2048,
    cacheSystem: true,
  })
}
