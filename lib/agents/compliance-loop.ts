import type { ComplianceGrade, ComplianceResult } from '@/types'
import { runCompliance } from './compliance'
import { runComplianceRewriter } from './compliance-rewriter'

// Full-cycle compliance convergence: gate → rewrite → regrade, repeated
// until the script comes out clean (or REMOVE / round budget).
//
// Why a loop and not one pass: the LLM gate is not deterministic — after
// a rewrite it can flag excerpts it missed the first time, or the new
// wording trips a different rule. One pass ships scripts with leftover
// findings; the product contract is "the doctor gets a finished script,
// not a compliance to-do list". The gate still runs on every round and
// the FINAL verdict is always the real one — findings are resolved, never
// hidden.

const GRADE_RANK: Record<ComplianceGrade, number> = {
  PASS: 0,
  REVIEW: 1,
  REWORD: 2,
  REMOVE: 3,
}

export interface ConvergeInput {
  script: string
  topic?: string | null
  category?: string | null
  niche?: string | null
  /** Reuse an already-computed first grade instead of paying for it again. */
  initial?: ComplianceResult
  /** Rewrite→regrade rounds after the initial grade. */
  maxRounds?: number
}

export interface ConvergeOutput {
  script: string
  compliance: ComplianceResult
  rounds: number
}

export async function convergeCompliance(
  input: ConvergeInput
): Promise<ConvergeOutput> {
  const { topic, category, niche, maxRounds = 3 } = input

  let script = input.script
  let result =
    input.initial ??
    (await runCompliance({ script, topic, category, niche }))
  let rounds = 0

  while (
    (result.grade === 'REWORD' || result.grade === 'REVIEW') &&
    rounds < maxRounds
  ) {
    const fixed = await runComplianceRewriter({
      script,
      findings: result.findings,
      niche,
    }).catch(() => null)
    if (!fixed || fixed === script) break

    const recheck = await runCompliance({
      script: fixed,
      topic,
      category,
      niche,
    }).catch(() => null)
    if (!recheck) break

    rounds += 1
    // Accept the rewrite unless it made things strictly worse — the
    // round budget caps oscillation either way.
    if (GRADE_RANK[recheck.grade] <= GRADE_RANK[result.grade]) {
      script = fixed
      result = recheck
      if (result.grade === 'PASS') break
    } else {
      break
    }
  }

  return { script, compliance: result, rounds }
}
