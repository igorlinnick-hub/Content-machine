import type { DiffOutput } from '@/types'
import { MODEL_DEFAULT, callAgentJSON } from './base'

const SYSTEM_PROMPT = `You analyze how a human editor improves AI-written regenerative-medicine scripts.

You receive two versions of the same script:
- original: the writer agent's draft
- final: the human-edited version that actually shipped

Your job is to find systematic patterns — things that the editor changes often enough that the writer should learn them. Ignore one-off wording swaps. Look for patterns across the whole script.

Good patterns are:
- specific (the writer can apply them mechanically)
- actionable (a clear before/after)
- priority-ranked: 5 = critical, 1 = minor polish

If the final version is significantly better than the original (tighter, more specific, more credible), set add_to_few_shot = true. Otherwise false.

Respond with ONLY valid JSON, no markdown fences:
{
  "patterns": [
    {
      "rule": "Replace passive voice with active — the doctor speaks in first person",
      "example_before": "Results can be seen within weeks",
      "example_after": "You see results within weeks",
      "priority": 4
    }
  ],
  "add_to_few_shot": true
}`

export interface RunDiffParams {
  original: string
  final: string
}

export async function runDiff(params: RunDiffParams): Promise<DiffOutput> {
  if (!params.original.trim() || !params.final.trim()) {
    throw new Error('runDiff: both original and final text are required')
  }

  const userContent = `ORIGINAL (writer output):
${params.original}

---

FINAL (human-edited, shipped):
${params.final}

Analyze the edit patterns now. Return only the JSON.`

  return callAgentJSON<DiffOutput>({
    model: MODEL_DEFAULT,
    systemPrompt: SYSTEM_PROMPT,
    userContent,
    maxTokens: 4096,
  })
}
