import type { Skin } from '../types'

// Style 6 — "paper microblog": Yedino's own brand. Warm paper, very heavy
// black caps, one paragraph sitting inside a stepped blue highlight, a few
// hand-drawn doodles in the accent, the logo badge top-right and the handle
// bottom-left.
//
// Tokens read off the Canva master DAHVe9aREe4 after Igor finished it by hand
// on 2026-09-17 (see docs/handoff/yedino.md for the element map):
//   paper  #f2ede0    ink #050505    accent #2a7bd5
//   body copy is CREAM on the blue highlight, not black on paper
//
// Fonts: the master's faces are Canva-internal and come back obfuscated
// (`YACgEcnJpjs` / `YAFdJvSyp_k`), so they cannot be identified, let alone
// licensed. Inter's variable file is already embedded by lib/render/fonts.ts
// and carries a 900 weight, which is the closest heavy grotesk we own today.
// Swapping in the real faces later is one file in assets/fonts + one line in
// fonts.ts — nothing here changes.
export const style6: Skin = {
  id: 6,
  key: 'style6',
  name: 'Style 6 — Yedino',

  background: '#f2ede0',
  // Unused on a paper surface, but the type demands them; kept sane so a
  // future photo variant of this skin has somewhere to start.
  panel: '#f2ede0',
  panelText: '#050505',

  headingFamily: "'Inter', -apple-system, Arial, sans-serif",
  headingStyle: 'normal',
  headingWeight: 900,
  headingTransform: 'uppercase',
  // Body-slide heading. The cover gets its own, larger size in the builder,
  // the way the master does (150 on the cover, ~112 on body slides).
  headingSize: 112,

  bodyFamily: "'Inter', -apple-system, Arial, sans-serif",
  bodyWeight: 400,
  bodySize: 43,

  rule: 'rgba(5,5,5,0.16)',
  accent: '#2a7bd5',
  radius: 0,
  coverPhoto: false,
  panelEdge: 'straight',

  surface: 'paper',
  paperTint: '#f2ede0',
  ink: '#050505',
  highlight: '#2a7bd5',
  highlightInk: '#f2ede0',
  doodles: true,
}
