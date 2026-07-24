import { MODEL_HAIKU, callAgentTool } from './base'
import type { ComplianceFinding } from '@/types'
import { getNicheProfile } from '@/lib/niche/profiles'

// Compliance auto-rewriter — applies REWORD corrections from compliance gate.
// Haiku-powered: mechanical edit task, not creative writing.
// One pass per variant, max one retry in the generate route.

export async function runComplianceRewriter(input: {
  script: string
  findings: ComplianceFinding[]
  /** Clinic niche — used to label the editor persona in the system prompt. */
  niche?: string | null
}): Promise<string> {
  // ONLY reword findings — their `correction` is replacement wording.
  // `review` findings carry an instruction for a HUMAN reviewer
  // ("a medical professional should verify…"); feeding those to the
  // model pasted reviewer notes straight into post text (2026-07-23).
  const reworderFindings = input.findings.filter(
    (f) => f.severity === 'reword'
  )
  if (reworderFindings.length === 0) return input.script

  const correctionsList = reworderFindings
    .map((f, i) => `${i + 1}. Replace: "${f.matched}"\n   With: ${f.correction}`)
    .join('\n')

  const profile = getNicheProfile(input.niche)
  const result = await callAgentTool<{ script: string }>({
    model: MODEL_HAIKU,
    systemPrompt: `You are a medical content editor for a ${profile.label} clinic. Apply the specified compliance corrections to the script. Change ONLY the flagged phrases — preserve all other content, tone, structure, and line breaks exactly as-is.

RESOLUTION STRATEGY — the corrected script must not re-trigger the same class of rule:
• Unattributed statistic / percentage / patient count / time-to-result: NEVER invent a source. If the flagged sentence already names a study/trial/journal, keep the name and hedge the number ("roughly", "about", "studies report"). Otherwise REPLACE the specific number with qualitative hedged phrasing ("many patients", "a meaningful share of patients", "studies suggest improvement for some patients").
• Specific FDA approval / clearance year or date: drop the year. "FDA-cleared for X since 2008" → "FDA-cleared for X".
• Dosage / protocol specifics: add "typically" / "commonly", or generalize ("over several weeks").
• Currency claims ("currently", "as of 2025", "the only FDA-approved"): remove the currency framing; state the fact without a time anchor.
• Missing hedge: weave one naturally into the flagged sentence ("may help", "some patients", "talk to your doctor").
The edit must read naturally in the doctor's voice — not like a disclaimer was bolted on.

HARD RULES:
• A correction may be phrased as an instruction or reviewer note. NEVER copy
  instruction text into the script — translate it into natural, compliant
  wording of the SAME claim.
• Never add reviewer notes, meta commentary, editor asides, or disclaimers
  aimed at the writer.
• Never delete, merge, or shorten sentences that were not flagged. Every
  slide, every SOURCES line, and every header stays exactly where it was.
• Output length must be within ~10% of the input length.`,
    userContent: `Script:\n${input.script}\n\nApply these corrections:\n${correctionsList}`,
    toolName: 'return_corrected_script',
    toolDescription: 'Return the compliance-corrected script.',
    inputSchema: {
      type: 'object',
      properties: {
        script: { type: 'string', description: 'The full corrected script.' },
      },
      required: ['script'],
    },
    // Long carousels + SOURCES section exceed 2048 — truncation here
    // silently amputated script tails.
    maxTokens: 4096,
  })

  return typeof result?.script === 'string' && result.script.length > 50
    ? result.script
    : input.script
}
