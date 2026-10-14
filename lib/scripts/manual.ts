// Scripts a person pasted in ("+ Add your own script" on /scripts) —
// scripts.source = 'manual' (migration 065).
//
// They skip Writer and Critic, so the compliance gate is the only screen
// they get: it runs on save, on every text edit, and its verdict decides
// whether the script may be starred onto the doctor's list.
//
// Pure helpers only — imported by the client list as well as the routes,
// so nothing here may pull in the agent/SDK code.

import type { ComplianceResult } from '@/types'
import { cleanReadingText } from '@/lib/client/script-text'
import { spokenScript } from '@/lib/posts/spoken'

export const MANUAL_SOURCE = 'manual'

/** Longest script a person can paste — a 3-minute take is ~450 words. */
export const MANUAL_SCRIPT_MAX_CHARS = 20_000

/**
 * The hook of a spoken script IS its first line — same rule the
 * teleprompter uses when it saves an edit, so captions and the card
 * read the opening the doctor actually says.
 */
export function deriveHook(body: string): string | null {
  const first =
    cleanReadingText(spokenScript(body.trim()))
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? ''
  return first && first.length <= 300 ? first : null
}

/**
 * The text the gate grades. The hook is normally the body's first line;
 * when someone typed a different one in the edit form it is spoken too,
 * so it goes in front.
 */
export function gradedText(hook: string | null, body: string): string {
  const squash = (s: string) => s.replace(/\s+/g, ' ').trim()
  if (!hook || squash(body).includes(squash(hook))) return body
  return `${hook}\n\n${body}`
}

/**
 * Why this script may not be starred yet, or null when it may.
 * Same block rule as shouldBlockPublish (REMOVE / REWORD) — repeated
 * here because that module pulls in the agent SDK.
 * Machine-written rows with no stored verdict keep their old behaviour.
 * `screened` = the clinic's niche goes through the gate (nicheIsScreened);
 * an unscreened account (HireDrop) never locks the star.
 */
export function starBlockReason(
  row: {
    source: string | null
    compliance: ComplianceResult | null
  },
  screened = true
): string | null {
  if (!screened) return null
  const grade = row.compliance?.grade
  if (grade === 'REMOVE' || grade === 'REWORD') {
    return 'Flagged wording — fix it before it goes to the doctor.'
  }
  const graded = row.compliance !== null && gateRan(row.compliance)
  if (!graded && row.source === MANUAL_SOURCE) {
    return 'Not checked yet — run the compliance check first.'
  }
  return null
}

/**
 * runCompliance never throws on an LLM failure — it returns REVIEW with a
 * GATE_ERROR finding so the pipeline routes the post to a human. For a
 * hand-written script that verdict means "not graded", not "needs review".
 */
export function gateRan(result: ComplianceResult): boolean {
  return result.model !== 'gate-error'
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}
