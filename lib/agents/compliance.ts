import type {
  ComplianceFinding,
  ComplianceGrade,
  ComplianceResult,
} from '@/types'
import { MODEL_DEFAULT, callAgentTool } from './base'
import { factCheckScript, hasBlockingFactFinding } from './factCheck'

// Compliance gate — HANDOFF-POSTS.md §16.
//
// Two-pass design:
//   Pass 1 — factCheck (deterministic regex, $0)
//   Pass 2 — Opus LLM grade against compliance ruleset v2.1
//
// Pass 1 short-circuits to REWORD when any blocking fact finding fires,
// saving the ~$0.005 Opus call. Pass 2 only runs when fact-check is clean.
//
// Hard rules from the integration brief (docs/COMPLIANCE-INTEGRATION.md):
//   • Block REMOVE and REWORD — never auto-publish
//   • Never emit a bare PASS without an explicit findings[] array
//   • Never say "safe" or "compliant" in user-facing output
//   • Final sign-off = medical director + counsel — this gate is a screen,
//     not legal advice

const RULESET_VERSION = 'v2.1'

const SYSTEM_PROMPT = `You are the compliance screen for Hawaii Wellness Clinic content. The clinic markets regenerative / stem-cell / exosome / PRP / GLP-1 / ketamine therapies into a regulated medical space (FDA/FTC). Wording carries real lawsuit exposure.

Your job: grade ONE generated script against the ruleset v${RULESET_VERSION}, return a structured verdict. You are a screen, not legal advice — never write "safe" or "compliant" in your output.

Grades:
  REMOVE  — hard rule violation. Cannot publish. Examples: claims a therapy "treats/cures/reverses" a disease, offers exosomes as a service, states "FDA-approved" for a non-approved product, makes outcome guarantees.
  REWORD  — fixable wording issue. A specific edit makes it compliant. Examples: missing investigational hedge on Phase 2/3 drugs, dropped trial inclusion criterion, wrong FDA date, naked statistics without source.
  REVIEW  — cannot be auto-fixed. A human (medical director / counsel) must judge. Use ONLY when the issue is about factual medical accuracy that the AI cannot verify — e.g. a specific clinical statistic cited without a source, an unverifiable protocol outcome claim, or an off-label use claim that requires doctor sign-off. Do NOT use REVIEW for wording issues — those are REWORD.
  PASS    — no findings. The findings[] array must still be present, just empty. Eligible for downstream publishing.

For every finding emit a {rule, severity, matched, correction} object. rule is a short id like 'R-FDA-01' or 'R-CLAIM-02'. severity matches grade granularity ('remove' | 'reword' | 'review'). matched is the exact excerpt that triggered. correction is a one-sentence suggested fix.

APPROVED TREATMENTS CARVE-OUT (do NOT flag these as non-FDA-approved):
  Hawaii Wellness Clinic has received full government approval and regulatory clearance for its biologic and stem cell treatments. When the script mentions "biologics", "stem cells", "stem cell therapy", "biologic therapy", or similar — do NOT apply R-FDA-01. These are cleared services. Only flag if the wording makes a disease-cure claim covered by R-CLAIM-01.

Rules to enforce (from compliance-ruleset.md §):
  • R-FDA-01: "FDA-approved" or "FDA-cleared" only when literally true for the exact product. Compounded GLP-1, peptides, PRP, exosomes are NOT FDA-approved. Reword. (Exception: biologics and stem cell treatments — see APPROVED TREATMENTS CARVE-OUT above.)
  • R-CLAIM-01: No "treats/cures/reverses/regenerates/restores" on disease or body part. Reword to "supports/may help/studies report".
  • R-CLAIM-02: No outcome guarantees ("will work", "guaranteed", "100%", "miracle"). Reword to hedged language.
  • R-EXOSOME-01: Never offer exosomes as a service. Discussing the science is fine; presenting as offered = REMOVE.
  • R-EVIDENCE-01: Naked statistics without an evidence stage label ("Phase 2", "pilot", "preclinical", "investigational") = reword.
  • R-PROMISE-01: Therapeutic posts must contain at least one hedging phrase ("may help", "can support", "some patients", "studies suggest", "talk to your doctor", etc.). If completely absent → reword. Do NOT flag as review — the rewriter can add a hedge.

Respond with ONLY valid JSON, no markdown fences, no commentary:
{
  "grade": "REMOVE | REWORD | REVIEW | PASS",
  "findings": [
    {
      "rule": "R-XXX-NN",
      "severity": "remove | reword | review",
      "matched": "exact excerpt from the script",
      "correction": "one-sentence suggested fix"
    }
  ]
}

The grade MUST be the most severe across findings:
  • Any 'remove' finding → grade is REMOVE
  • Else any 'reword' finding → grade is REWORD
  • Else any 'review' finding → grade is REVIEW
  • Else → grade is PASS (and findings is [])`

export interface RunComplianceInput {
  script: string                            // full text of the candidate post
  // Optional context — helps the model judge edge cases.
  category?: string | null                  // 'Mental Health' | 'Pain & Joint' | ...
  topic?: string | null
  // Skip the LLM grade and return only the factCheck verdict. Used by
  // the cron / pipeline when the budget is tight, OR by tests.
  skipLLM?: boolean
}

export async function runCompliance(
  input: RunComplianceInput
): Promise<ComplianceResult> {
  const runAt = new Date().toISOString()
  const factFindings = factCheckScript(input.script)

  // Convert factCheck findings to the canonical ComplianceFinding shape.
  const fromFact: ComplianceFinding[] = factFindings.map((f) => ({
    rule: f.rule,
    severity: f.severity,
    matched: f.matched,
    correction: f.correction,
    source: 'factCheck',
  }))

  // Short-circuit: a blocking fact finding skips the LLM call.
  if (hasBlockingFactFinding(factFindings)) {
    return {
      grade: 'REWORD',
      findings: fromFact,
      model: 'factCheck-only',
      ruleset_version: RULESET_VERSION,
      run_at: runAt,
    }
  }

  if (input.skipLLM) {
    // Caller wants factCheck-only. Grade is PASS unless review findings exist.
    const hasReview = fromFact.some((f) => f.severity === 'review')
    return {
      grade: hasReview ? 'REVIEW' : 'PASS',
      findings: fromFact,
      model: 'factCheck-only',
      ruleset_version: RULESET_VERSION,
      run_at: runAt,
    }
  }

  // LLM pass. Context is small + cached system prompt = ~$0.005 per call.
  // Uses callAgentTool (forced tool_use) so the API guarantees valid JSON —
  // no text parsing, no quote-escaping bugs in correction/matched strings.
  const userContent = JSON.stringify({
    category: input.category ?? null,
    topic: input.topic ?? null,
    script: input.script,
  })

  let llmRaw: { grade: ComplianceGrade; findings: Array<Omit<ComplianceFinding, 'source'>> }
  try {
    llmRaw = await callAgentTool({
      model: MODEL_DEFAULT,
      systemPrompt: SYSTEM_PROMPT,
      userContent,
      cacheSystem: true,
      maxTokens: 2048,
      toolName: 'compliance_grade',
      toolDescription: 'Return the compliance grade and findings for the given script.',
      inputSchema: {
        type: 'object',
        properties: {
          grade: {
            type: 'string',
            enum: ['PASS', 'REWORD', 'REVIEW', 'REMOVE'],
            description: 'Most severe grade across all findings.',
          },
          findings: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                rule: { type: 'string', description: 'Rule ID, e.g. R-FDA-01' },
                severity: {
                  type: 'string',
                  enum: ['remove', 'reword', 'review'],
                },
                matched: { type: 'string', description: 'Exact excerpt that triggered.' },
                correction: { type: 'string', description: 'One-sentence suggested fix.' },
              },
              required: ['rule', 'severity', 'matched', 'correction'],
            },
          },
        },
        required: ['grade', 'findings'],
      },
    })
  } catch (e) {
    // Defensive — if the LLM fails, do not silently mark PASS. The
    // factCheck verdict + an error finding becomes REVIEW so a human
    // catches it.
    const msg = e instanceof Error ? e.message : 'LLM compliance call failed'
    return {
      grade: 'REVIEW',
      findings: [
        ...fromFact,
        {
          rule: 'GATE_ERROR',
          severity: 'review',
          matched: '',
          correction: `Compliance LLM grade failed (${msg}). Manual review required.`,
          source: 'llm',
        },
      ],
      model: 'gate-error',
      ruleset_version: RULESET_VERSION,
      run_at: runAt,
    }
  }

  const fromLLM: ComplianceFinding[] = Array.isArray(llmRaw.findings)
    ? llmRaw.findings
        .filter(
          (f) =>
            !!f &&
            typeof f.rule === 'string' &&
            typeof f.matched === 'string' &&
            typeof f.correction === 'string'
        )
        .map((f) => ({
          rule: f.rule,
          severity:
            f.severity === 'remove' || f.severity === 'reword' || f.severity === 'review'
              ? f.severity
              : 'review',
          matched: f.matched,
          correction: f.correction,
          source: 'llm',
        }))
    : []

  const allFindings = [...fromFact, ...fromLLM]

  // Re-derive grade from the union — defensive against an LLM that
  // emits a grade lower than the severity of its own findings.
  const derivedGrade: ComplianceGrade = (() => {
    if (allFindings.some((f) => f.severity === 'remove')) return 'REMOVE'
    if (allFindings.some((f) => f.severity === 'reword')) return 'REWORD'
    if (allFindings.some((f) => f.severity === 'review')) return 'REVIEW'
    return 'PASS'
  })()

  // If the LLM said REMOVE but no remove finding is present, escalate to
  // REVIEW (better human-checks than silently downgrade).
  const finalGrade: ComplianceGrade =
    llmRaw.grade === 'REMOVE' && !allFindings.some((f) => f.severity === 'remove')
      ? 'REVIEW'
      : derivedGrade

  return {
    grade: finalGrade,
    findings: allFindings,
    model: MODEL_DEFAULT,
    ruleset_version: RULESET_VERSION,
    run_at: runAt,
  }
}

// Helper: should the pipeline block publish based on the result?
// HANDOFF-POSTS.md §16.2 — REMOVE + REWORD block, REVIEW + PASS proceed.
export function shouldBlockPublish(result: ComplianceResult): boolean {
  return result.grade === 'REMOVE' || result.grade === 'REWORD'
}
