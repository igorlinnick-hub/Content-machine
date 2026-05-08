import type {
  SharedContext,
  WriterOutput,
  CriticOutput,
  ScriptLengthTarget,
} from '@/types'
import { MODEL_CRITIC, callAgentJSON } from './base'

const LENGTH_BANDS: Record<ScriptLengthTarget, { min: number; max: number; label: string }> = {
  short: { min: 200, max: 220, label: '60-90s boost cut' },
  long: { min: 420, max: 540, label: '2-3min organic' },
}

function buildSystemPrompt(target: ScriptLengthTarget): string {
  const band = LENGTH_BANDS[target]
  return `You are an editor for medical content. Evaluate scripts strictly — the doctor's reputation depends on it.

The variants below were written for a ${band.label} (${target}). Their target length is ${band.min}-${band.max} words.

For each variant, score five criteria on a 1-10 scale:
- tone_match: fit with the clinic's declared tone and audience.
- no_promises: absence of medical promises ("cure", "guaranteed", "100%", "always works", "fixes X").
- hook_quality: how concrete and specific the hook is. Generic or abstract hooks score low.
- length_ok: how close to ${band.min}-${band.max} words the script is. Count the words yourself — do not trust the variant's self-reported count. ${band.min}-${band.max} → 9-10. Within ±10% → 7-8. Further out → progressively lower.
- science_present: a specific scientific fact, mechanism, or study is present and credible.

total_score = average of the five criteria, rounded to one decimal place.
approved = true only if total_score >= 7 AND no_promises >= 8 AND the script does not violate any clinic medical_restrictions.

For each variant, write feedback that is short and actionable — point to the specific sentence or rule to fix. Do not praise; focus on what would make the rewrite better. If the variant is already strong, say so in one sentence.

Respond with ONLY valid JSON, no markdown fences, no commentary:
{
  "scores": [
    {
      "variant_id": "v1",
      "total_score": 8.2,
      "criteria": {
        "tone_match": 8,
        "no_promises": 9,
        "hook_quality": 7,
        "length_ok": 9,
        "science_present": 8
      },
      "approved": true,
      "feedback": "..."
    }
  ]
}`
}

function buildCriticBrief(ctx: SharedContext, variants: WriterOutput): string {
  const p = ctx.clinic_profile
  const restrictions = p.medical_restrictions.join('; ') || 'none specified'

  const variantsBlock = variants.variants
    .map(
      (v) => `--- Variant ${v.id} ---
Topic: ${v.topic}
Hook: ${v.hook}
Self-reported word count: ${v.word_count}
Script:
${v.script}`
    )
    .join('\n\n')

  return `CLINIC TONE: ${p.tone}
AUDIENCE: ${p.audience || 'n/a'}
MEDICAL RESTRICTIONS: ${restrictions}

VARIANTS TO EVALUATE:

${variantsBlock}

Score all variants now. Return only the JSON object.`
}

export interface RunCriticParams {
  context: SharedContext
  variants: WriterOutput
  lengthTarget?: ScriptLengthTarget
}

export async function runCritic(params: RunCriticParams): Promise<CriticOutput> {
  const target: ScriptLengthTarget = params.lengthTarget ?? 'short'
  return callAgentJSON<CriticOutput>({
    model: MODEL_CRITIC,
    systemPrompt: buildSystemPrompt(target),
    userContent: buildCriticBrief(params.context, params.variants),
    maxTokens: 8192,
    effort: 'medium',
  })
}
