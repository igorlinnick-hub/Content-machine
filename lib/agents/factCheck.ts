// Deterministic fact-check pass keyed off docs/content-plan-2026-06.md §4.2.
// Runs BEFORE lib/agents/compliance.ts. Pure regex, no LLM, no network.
//
// Why this exists: the LLM-graded compliance gate catches tone violations
// and policy breaches, but a writer regression can still emit pure fact
// errors (wrong FDA dates, dropped trial criteria, missing investigational
// hedges). Those slip past tone-focused grading. This module is the
// vocabulary list — extend whenever the content plan publishes new
// corrections.
//
// All findings here graduate the compliance verdict to at least REWORD
// (severity 'reword') or REVIEW (severity 'review'). The gate never
// overrides a fact finding — even a PASS-tone post is graded down if
// a fact rule fires.

export type FactSeverity = 'reword' | 'review'

export interface FactFinding {
  rule: string                 // stable rule id, e.g. 'FACT_TMS_DATE'
  severity: FactSeverity
  matched: string              // human-readable excerpt that triggered
  correction: string           // suggested correction for the writer/reviewer
}

// Each rule is intentionally narrow and case-insensitive on intent words.
// Adding rules costs ~5 lines. Removing rules requires a migration of
// stored compliance JSONB? No — old findings just sit in history.
export function factCheckScript(script: string): FactFinding[] {
  const findings: FactFinding[] = []
  if (!script || typeof script !== 'string') return findings

  // FACT_TMS_DATE — anxious depression year must be 2021, not 2020
  if (/tms[^.\n]{0,80}anxious[^.\n]{0,40}depression[^.\n]{0,40}2020/i.test(script)) {
    findings.push({
      rule: 'FACT_TMS_DATE',
      severity: 'reword',
      matched: 'TMS anxious depression 2020',
      correction:
        'TMS clearance for anxious depression is 2021, not 2020. See docs/content-plan-2026-06.md §4.2.',
    })
  }

  // FACT_SELECT_ESTABLISHED — SELECT must mention "established CVD"
  if (
    /SELECT\s+(trial|study|enrolled)/i.test(script) &&
    !/established\s+cardiovascular/i.test(script)
  ) {
    findings.push({
      rule: 'FACT_SELECT_ESTABLISHED',
      severity: 'reword',
      matched: 'SELECT mentioned without "established cardiovascular disease"',
      correction:
        'SELECT enrolled 17,604 adults with ESTABLISHED cardiovascular disease (NEJM 2023). The word "established" is the inclusion criterion and must not be dropped.',
    })
  }

  // FACT_RETATRUTIDE_INVESTIGATIONAL — must carry an investigational hedge
  if (
    /retatrutide/i.test(script) &&
    !/(investigational|not\s+FDA[- ]approved|phase\s*[23]|TRIUMPH)/i.test(script)
  ) {
    findings.push({
      rule: 'FACT_RETATRUTIDE_INVESTIGATIONAL',
      severity: 'reword',
      matched: 'retatrutide without "investigational" / phase / "not FDA-approved" hedge',
      correction:
        'Retatrutide is investigational, not FDA-approved as of 2026. Always label evidence stage (Phase 2 NEJM 2023; Phase 3 TRIUMPH Dec 2025).',
    })
  }

  // FACT_SPRAVATO_MONOTHERAPY — when monotherapy is discussed, 2025 date is required
  if (
    /spravato/i.test(script) &&
    /monotherapy/i.test(script) &&
    !/2025/.test(script)
  ) {
    findings.push({
      rule: 'FACT_SPRAVATO_MONOTHERAPY',
      severity: 'review',
      matched: 'Spravato monotherapy discussed without 2025 date',
      correction:
        'Spravato monotherapy clearance is Jan 2025. Cite the year explicitly.',
    })
  }

  // FACT_ED_STAT — must use the "40-70" range, not "over 40"
  if (
    /erectile\s+dysfunction/i.test(script) &&
    /over\s+40/i.test(script) &&
    !/40\s*[-–—]\s*70/i.test(script)
  ) {
    findings.push({
      rule: 'FACT_ED_STAT',
      severity: 'reword',
      matched: '"over 40" framing for ED prevalence',
      correction:
        'Correct ED stat: ~52% of men aged 40–70 (Massachusetts Male Aging Study). "Over 40" is the older, less precise framing the v2 plan removed.',
    })
  }

  // FACT_NAD_PERCENT — naked NAD+ decline percentages need a source
  if (
    /NAD\+?/i.test(script) &&
    /\b\d{2}%\s+(by\s+(age\s+)?\d{2}|drop|decline)/i.test(script)
  ) {
    findings.push({
      rule: 'FACT_NAD_PERCENT',
      severity: 'review',
      matched: 'specific NAD+ decline percentage',
      correction:
        'NAD+ specific decline percentages (e.g. "50% by 40 / 80% by 60") are not well-established. The v2 plan removed them. Use "declines with age, human trials ongoing".',
    })
  }

  // FACT_EXOSOMES_SERVICE — never offer exosomes as a service (FDA: no approved products)
  if (
    /(we\s+offer|our\s+(exosome|exosomes)|exosome\s+(therapy|treatment|protocol|service)|book\s+(an?\s+)?exosome)/i.test(
      script
    )
  ) {
    findings.push({
      rule: 'FACT_EXOSOMES_SERVICE',
      severity: 'reword',
      matched: 'exosomes presented as offered service',
      correction:
        'FDA: no approved exosome products. Never list exosomes as a service offered. Discuss the science only — do not present as a clinic offering.',
    })
  }

  // FACT_TREAT_CURE_REGEN — any direct treats/cures/regenerates/restores claim
  if (
    /\b(treats|cures|reverses|regenerates|restores|heals)\s+(your|the|chronic|all|any)?\s*(disease|cancer|alzheim|parkinson|condition|joint|tissue|organ)/i.test(
      script
    )
  ) {
    findings.push({
      rule: 'FACT_TREAT_CURE_REGEN',
      severity: 'reword',
      matched: 'direct treats/cures/regenerates claim on a disease or body part',
      correction:
        'Never claim a therapy "treats / cures / reverses / regenerates / restores". Use "supports", "may help", "studies report", "pilot data shows".',
    })
  }

  return findings
}

// Helper for tests + the compliance gate: returns true if ANY 'reword'
// finding exists. Callers use this to short-circuit to REWORD without
// paying for the LLM grade.
export function hasBlockingFactFinding(findings: FactFinding[]): boolean {
  return findings.some((f) => f.severity === 'reword')
}
