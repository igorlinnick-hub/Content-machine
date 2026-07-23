// Display-time cleanup of structured scripts for READING surfaces
// (teleprompter, dashboard script modal). Writer output keeps its
// slide markup in the DB — the splitter needs it for carousels —
// but a doctor reading aloud should see clean prose:
//   - "Slide 3 — Mechanism / Real Cause" header lines dropped
//   - bullet markers dropped (text kept)
//   - spaced dashes become commas (a dash is just a spoken pause)

export function cleanReadingText(body: string): string {
  return body
    .split('\n')
    .filter((line) => !/^\s*slide\s*\d+\s*([—–:-].*)?$/i.test(line))
    .map((line) =>
      line
        .replace(/^\s*[•*-]\s+/, '')
        // Carousel CTA tails aren't spoken: "… Swipe →"
        .replace(/\s*swipe\s*(→|->)?\s*$/i, '')
    )
    .join('\n')
    .replace(/\s+[—–]\s+/g, ', ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
