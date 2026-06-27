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
  const reworderFindings = input.findings.filter(
    (f) => f.severity === 'reword' || f.severity === 'review'
  )
  if (reworderFindings.length === 0) return input.script

  const correctionsList = reworderFindings
    .map((f, i) => `${i + 1}. Replace: "${f.matched}"\n   With: ${f.correction}`)
    .join('\n')

  const profile = getNicheProfile(input.niche)
  const result = await callAgentTool<{ script: string }>({
    model: MODEL_HAIKU,
    systemPrompt: `You are a medical content editor for a ${profile.label} clinic. Apply the specified compliance corrections to the script. Change ONLY the flagged phrases — preserve all other content, tone, structure, and line breaks exactly as-is.`,
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
    maxTokens: 2048,
  })

  return typeof result?.script === 'string' && result.script.length > 50
    ? result.script
    : input.script
}
