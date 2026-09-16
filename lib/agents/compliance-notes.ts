// Reviewer notes must never reach a script. The compliance rewriter is
// handed corrections that are sometimes phrased as instructions to a
// human ("a medical professional should confirm this characterization is
// accurate for public-facing communication"), and despite the prompt
// forbidding it the model still pastes one in now and then — one shipped
// into a doctor's teleprompter script on 2026-08-22 and was read on
// camera. The prompt is the ask; this is the enforcement.
//
// Pure string work on purpose: no model, no imports, so it can be tested
// and reasoned about on its own.

// Signatures of text addressed to a reviewer/editor rather than to a
// patient. Deliberately narrow — a doctor saying "talk to your doctor"
// or "ask a professional about your case" is normal patient-facing
// language and must survive.
const REVIEWER_NOTE_PATTERNS: RegExp[] = [
  /\b(?:a|the)\s+(?:medical|healthcare|clinical|licensed)\s+(?:professional|provider|reviewer|director)\s+(?:should|must|needs? to)\s+(?:confirm|verify|review|validate|substantiate|approve)\b/i,
  /\b(?:should|must)\s+be\s+(?:confirmed|verified|reviewed|validated|substantiated)\s+(?:by|before|prior)\b/i,
  /\bfor\s+public[- ]facing\s+(?:patient\s+)?(?:communication|content|material)/i,
  /\b(?:sufficiently|adequately)\s+(?:complete|accurate|supported)\b/i,
  /\b(?:this|the)\s+(?:claim|statement|characterization|wording|phrasing)\s+(?:should|must|needs? to|requires?)\b/i,
  /\b(?:requires?|needs?)\s+(?:clinical|medical|legal|compliance)\s+(?:review|sign[- ]?off|substantiation)\b/i,
  /\b(?:reviewer|editor|compliance)\s+note\b/i,
]

export function isReviewerNote(sentence: string): boolean {
  return REVIEWER_NOTE_PATTERNS.some((re) => re.test(sentence))
}

// Split on sentence ends while keeping the trailing punctuation and the
// whitespace that follows, so re-joining the survivors reproduces the
// original spacing — line breaks in a carousel script are structural.
function splitSentences(text: string): string[] {
  return text.match(/[^.!?\n]*(?:[.!?]+|\n+|$)/g)?.filter((s) => s !== '') ?? []
}

export interface NoteStripResult {
  text: string
  removed: string[]
}

// Remove reviewer-note sentences that the rewriter ADDED. A sentence
// already present in the input is left alone: it came from the writer, it
// is the gate's problem to flag, and silently deleting the author's text
// is not this function's job.
export function stripAddedReviewerNotes(
  rewritten: string,
  original: string
): NoteStripResult {
  const before = new Set(splitSentences(original).map((s) => s.trim()))
  const removed: string[] = []
  const kept = splitSentences(rewritten).filter((s) => {
    const trimmed = s.trim()
    if (!trimmed) return true
    if (before.has(trimmed)) return true
    if (!isReviewerNote(trimmed)) return true
    removed.push(trimmed)
    return false
  })
  // Collapse the blank run a removal can leave mid-paragraph, but keep
  // the deliberate blank line between script lines.
  const text = kept.join('').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n')
  return { text, removed }
}
