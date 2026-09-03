import type { Skin } from '../types'

// Style 3 — "editorial diagonal": near-black page, full-bleed photo, a teal
// gradient panel cut on a diagonal, serif-italic caps headings over sans body.
// Tokens read off the Canva master DAHRSiuJEHQ and the carousels it produced
// (DAHSM_Jfrd8 / DAHSNLOxoTo), so the code render lands next to the Canva one.
export const style3: Skin = {
  id: 3,
  key: 'style3',
  name: 'Style 3',

  background: '#050d16',
  panel: 'linear-gradient(115deg, #2f8fa8 0%, #2d7fc4 55%, #2b6fd0 100%)',
  panelText: '#ffffff',

  headingFamily: "'Playfair Display', Georgia, serif",
  headingStyle: 'italic',
  headingWeight: 700,
  headingTransform: 'uppercase',
  headingSize: 64,

  bodyFamily: "'Inter', -apple-system, Arial, sans-serif",
  bodyWeight: 400,
  bodySize: 40,

  rule: 'rgba(255,255,255,0.45)',
  accent: '#8fd3e8',
  radius: 0,

  // The master's cover is a branded surface, not a photo (SKILL.md §"Cover
  // rules": Style 2/3 branded, Style 1/4 photo). Flip this to true and the
  // same code draws a photo cover — that is the whole point of a token.
  coverPhoto: false,
  panelEdge: 'diagonal',
}
