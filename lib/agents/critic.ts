import type {
  SharedContext,
  WriterOutput,
  CriticOutput,
  ScriptLengthTarget,
} from '@/types'
import { MODEL_CRITIC, callAgentTool } from './base'
import { findTeaserLines, findClicheLines } from './teaser-lines'

const LENGTH_BANDS: Record<ScriptLengthTarget, { min: number; max: number; label: string }> = {
  short: { min: 200, max: 220, label: '60-90s boost cut' },
  long: { min: 420, max: 540, label: '2-3min organic' },
  ad: { min: 90, max: 140, label: '25-45s paid spot' },
}

// Two of the six criteria mean something different for a paid spot, and
// scoring an ad against the organic rubric reliably fails a correct script
// (Igor 2026-08-20): a 100-word ad has no room to cite a trial, and its hook
// is deliberately a flat declarative rather than the "concrete fact or
// question" the organic rubric rewards. This block is appended only for the
// 'ad' target; everything else in the rubric still binds.
const AD_RUBRIC_OVERRIDE = `

THIS IS A PAID AD SPOT — TWO CRITERIA ARE READ DIFFERENTLY:
- science_present: for an ad, a MECHANISM sentence satisfies this criterion in full — what physically happens, in plain words, ending on the part that is genuinely remarkable ("the material integrates with your body's own biology and what grows back is real living bone"). A named study is NOT required and usually cannot fit at this length; do not mark a variant down for lacking one. Do mark it down if the mechanism is absent, vague, or overstated beyond what is true.
- hook_quality: an ad hook MUST be a flat declarative carrying a stance. A question ("Did you know…", "Are you struggling with…"), an opening statistic, a count-promise ("Three things about…") or a command ("Stop doing X") scores ≤ 3 and approved = false — these are the exact shapes real doctor ads avoid.

AND ONE ADDITIONAL HARD FAIL, SPECIFIC TO ADS:
- ENGAGEMENT BAIT IN THE SPOKEN SCRIPT. An ad's call-to-action lives in the caption and the ad unit, never in the doctor's voice. If the script contains "comment", "DM", "link in bio", "save this", "share this", "watch till the end", "swipe", "tap", "click", or any paraphrase asking the viewer to interact, set hook_quality ≤ 3, approved = false, and quote the sentence. A quiet closing line of possibility ("There's always a way forward.") is NOT bait and must not be flagged.
- Abstract-noun payoffs are a tone_match failure here: "confidence", "freedom", "journey", "quality of life", "transform" as the result of the procedure → tone_match ≤ 5. The result belongs in ordinary verbs ("you brush them, you eat with them").`

function buildSystemPrompt(target: ScriptLengthTarget): string {
  const band = LENGTH_BANDS[target]
  const adOverride = target === 'ad' ? AD_RUBRIC_OVERRIDE : ''
  return `You are an editor for medical content. Evaluate scripts strictly — the doctor's reputation depends on it.

The variants below were written for a ${band.label} (${target}). Their target length is ${band.min}-${band.max} words.

For each variant, score SIX criteria on a 1-10 scale:
- tone_match: fit with the clinic's declared tone and audience — a calm doctor talking to one patient across the desk. CLICHÉS LOWER THIS SCORE: influencer-script / ChatGPT / ad-copy language of any kind — strawman openers ("Most people think…", "The standard story is…", "You've probably heard…", "Sound familiar?"), marketing filler ("game-changer", "unlock", "journey", "dive in", "at the end of the day", "it's important to note", "plays a key role", "when it comes to", "let's be honest", "the good news is", "holistic", "empower"), the tidy antithesis bow ("It's not X, it's Y"), rule-of-three abstract lists, a neat wrap-up line after every beat. These are EXAMPLES of categories, not a complete list — judge anything that sounds like a script addressing an audience rather than a doctor answering a person. One cliché sentence → tone_match ≤ 6; two or more → tone_match ≤ 4 and approved = false. Quote each one in feedback.
- no_promises: absence of medical promises ("cure", "guaranteed", "100%", "always works", "fixes X").
- hook_quality: how concrete and specific the hook is. Generic or abstract hooks score low. TEASER / ANNOUNCER LINES ARE BANNED anywhere in the script — sentences that promise content instead of delivering it: "Here's why that's already too late.", "Here's what's actually happening.", "Here's the thing / the catch.", "Let me explain.", "Let's break it down.", "Stay with me.", "The truth is:", "This is where it gets interesting.", "Let that sink in." and ANY paraphrase (test: delete the sentence — if nothing is lost, it was a teaser). If ONE such line is present → hook_quality ≤ 3 and approved = false, and the feedback MUST quote the exact sentence and tell the writer to replace it with the actual claim.
The brief may list DETECTED TEASER LINES / DETECTED CLICHÉS found by a pattern scan — treat those as confirmed, and still look for paraphrases the scan missed; the scan is a floor, not the rule.
- length_ok: how close to ${band.min}-${band.max} words the script is. Count the words yourself — do not trust the variant's self-reported count. ${band.min}-${band.max} → 9-10. Within ±10% → 7-8. Further out → progressively lower.
- science_present: a specific scientific fact, mechanism, or study is present and credible.
- compliance_safe: absence of hard FDA/FTC violations. Score 1 if ANY of these are present: "treats/cures/reverses/heals [disease or condition]", "FDA-approved" for non-approved products (compounded GLP-1, peptides, PRP, exosomes are NOT FDA-approved), outcome guarantees ("will work", "guaranteed results", "you will see"), zero hedging phrases in a therapeutic post. Score 10 if none present and hedging ("may help", "studies suggest", "some patients") appears at least once.

total_score = average of the six criteria, rounded to one decimal place.
approved = true only if total_score >= 7 AND no_promises >= 8 AND compliance_safe >= 8 AND the script contains no teaser / announcer line AND fewer than two cliché sentences AND the script does not violate any clinic medical_restrictions.

For each variant, write feedback that is short and actionable — point to the specific sentence or rule to fix. Do not praise; focus on what would make the rewrite better. If the variant is already strong, say so in one sentence.${adOverride}`
}

function buildCriticBrief(ctx: SharedContext, variants: WriterOutput): string {
  const p = ctx.clinic_profile
  const restrictions = p.medical_restrictions.join('; ') || 'none specified'

  const variantsBlock = variants.variants
    .map((v) => {
      const text = `${v.hook ?? ''}\n${v.script ?? ''}`
      const teasers = findTeaserLines(text)
      const cliches = findClicheLines(text)
      const teaserBlock = teasers.length
        ? `\nDETECTED TEASER LINES (banned — hook_quality ≤ 3, approved = false, quote them in feedback):\n${teasers
            .map((t) => `  • "${t}"`)
            .join('\n')}`
        : ''
      const clicheBlock = cliches.length
        ? `\nDETECTED CLICHÉS (${cliches.length} — one → tone_match ≤ 6; two or more → tone_match ≤ 4 and approved = false; quote them in feedback):\n${cliches
            .map((t) => `  • "${t}"`)
            .join('\n')}`
        : ''
      return `--- Variant ${v.id} ---
Topic: ${v.topic}
Hook: ${v.hook}
Self-reported word count: ${v.word_count}${teaserBlock}${clicheBlock}
Script:
${v.script}`
    })
    .join('\n\n')

  return `CLINIC TONE: ${p.tone}
AUDIENCE: ${p.audience || 'n/a'}
MEDICAL RESTRICTIONS: ${restrictions}

VARIANTS TO EVALUATE:

${variantsBlock}

Score all variants. Call the score_variants tool with all scores.`
}

const SCORE_TOOL_SCHEMA = {
  type: 'object',
  properties: {
    scores: {
      type: 'array',
      items: {
        type: 'object',
        required: ['variant_id', 'total_score', 'criteria', 'approved', 'feedback'],
        properties: {
          variant_id: { type: 'string' },
          total_score: { type: 'number' },
          criteria: {
            type: 'object',
            required: ['tone_match', 'no_promises', 'hook_quality', 'length_ok', 'science_present', 'compliance_safe'],
            properties: {
              tone_match: { type: 'number' },
              no_promises: { type: 'number' },
              hook_quality: { type: 'number' },
              length_ok: { type: 'number' },
              science_present: { type: 'number' },
              compliance_safe: { type: 'number' },
            },
          },
          approved: { type: 'boolean' },
          feedback: { type: 'string' },
        },
      },
    },
  },
  required: ['scores'],
}

export interface RunCriticParams {
  context: SharedContext
  variants: WriterOutput
  lengthTarget?: ScriptLengthTarget
}

export async function runCritic(params: RunCriticParams): Promise<CriticOutput> {
  const target: ScriptLengthTarget = params.lengthTarget ?? 'short'
  return callAgentTool<CriticOutput>({
    model: MODEL_CRITIC,
    systemPrompt: buildSystemPrompt(target),
    userContent: buildCriticBrief(params.context, params.variants),
    toolName: 'score_variants',
    toolDescription: 'Return scores for all script variants.',
    inputSchema: SCORE_TOOL_SCHEMA,
    maxTokens: 8192,
    cacheSystem: true,
  })
}
