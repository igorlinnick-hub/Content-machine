// What the doctor actually SAYS on camera (Igor 2026-08-20).
//
// A carousel script's full_script is the canonical post text: spoken beats,
// then the CTA stack in arrow notation (Follow → … / Comment → … / Book → …),
// then a SOURCES: block with PMIDs. Captions, compliance and the splitter all
// need those blocks — the teleprompter must not show them: a doctor mid-take
// scrolled straight into "Comment → \"NAD+\" …, SOURCES: PMID 33888596".
//
// Video-mode scripts write their CTA as spoken prose (no arrow notation), so
// this strip only removes what was never speech.
export function spokenScript(script: string): string {
  const lines = script.split('\n')

  // Everything from the SOURCES: heading down is citation metadata.
  const sourcesAt = lines.findIndex((l) => /^\s*SOURCES\s*:?\s*$/i.test(l.trim()))
  const upToSources = sourcesAt === -1 ? lines : lines.slice(0, sourcesAt)

  // Arrow-notation CTA stack lines (may wrap onto continuation lines — only
  // the marker lines carry the arrow, so drop just those).
  const spoken = upToSources.filter(
    (l) => !/^\s*(Follow|Comment|Book)\s*→/i.test(l)
  )

  // Collapse the gaps the removals leave behind.
  return spoken
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
