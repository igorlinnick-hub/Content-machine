import { CANVAS, type RenderSlide, type Skin } from './types'

// One HTML builder for every shape and every skin. The skin decides how it
// looks; this file decides what a slide IS. That split is what removes the
// per-style special cases (Style 4's five body pages, Style 2's photoless
// cover, per-master panel sizes) that the Canva path had to carry.

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Diagonal cut height for the panel's top edge, in px. */
const CUT = 130

/**
 * Checklist vs numbered path. POST-CRAFT §4a assigns `✓` to candidacy slides
 * and `①②③` to step/protocol slides; that is a property of the heading, so it
 * can be decided here instead of being a judgement call per compose.
 */
function markersFor(heading: string | null | undefined): 'check' | 'number' {
  const h = (heading ?? '').toLowerCase()
  return /who|candidat|right for|you if|signs|red flag/.test(h) ? 'check' : 'number'
}

const NUMERALS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨']

function panelCss(skin: Skin): string {
  const cut =
    skin.panelEdge === 'diagonal'
      ? `clip-path:polygon(0 ${CUT}px, 100% 0, 100% 100%, 0 100%);padding-top:${CUT + 56}px;`
      : skin.panelEdge === 'curve'
        ? `border-radius:${CANVAS.width}px ${CANVAS.width}px 0 0 / 180px 180px 0 0;padding-top:120px;`
        : `border-radius:${skin.radius}px ${skin.radius}px 0 0;padding-top:64px;`
  return `background:${skin.panel};color:${skin.panelText};${cut}`
}

function photoLayer(photoUrl: string | null | undefined, skin: Skin): string {
  if (!photoUrl) {
    // No photo is not a defect — but a flat rectangle is. Give the page a
    // little depth so a photoless slide still reads as designed.
    return `<div class="bg" style="background:
      radial-gradient(120% 70% at 70% 0%, rgba(47,143,168,.30) 0%, transparent 60%),
      radial-gradient(90% 50% at 0% 20%, rgba(43,111,208,.22) 0%, transparent 65%),
      ${skin.background}"></div>`
  }
  return `<div class="bg" style="background-image:url('${photoUrl}');background-size:cover;background-position:center"></div>
    <div class="bg-shade"></div>`
}

function slideBody(slide: RenderSlide, skin: Skin): string {
  switch (slide.shape) {
    case 'cover': {
      return `
        ${slide.chip ? `<div class="chip">${esc(slide.chip)}</div>` : ''}
        <div class="spacer"></div>
        <section class="panel cover" id="fit">
          ${slide.heading ? `<h1 class="title">${esc(slide.heading)}</h1>` : ''}
          ${slide.body ? `<p class="hook">${esc(slide.body)}</p>` : ''}
        </section>`
    }
    case 'prose': {
      return `
        <div class="spacer"></div>
        <section class="panel" id="fit">
          ${slide.heading ? `<h2 class="heading">${esc(slide.heading)}</h2>` : ''}
          ${slide.body ? `<p class="body">${esc(slide.body)}</p>` : ''}
          ${slide.takeaway ? `<hr class="rule"><p class="takeaway">${esc(slide.takeaway)}</p>` : ''}
        </section>`
    }
    case 'list': {
      const mode = markersFor(slide.heading)
      const items = (slide.items ?? [])
        .map((item, i) => {
          const marker = mode === 'check' ? '✓' : (NUMERALS[i] ?? '•')
          return `<li><span class="marker">${marker}</span><span>${esc(item)}</span></li>`
        })
        .join('')
      return `
        <div class="spacer"></div>
        <section class="panel" id="fit">
          ${slide.heading ? `<h2 class="heading">${esc(slide.heading)}</h2>` : ''}
          ${slide.body ? `<p class="body lead">${esc(slide.body)}</p>` : ''}
          <ul class="items">${items}</ul>
          ${slide.takeaway ? `<hr class="rule"><p class="takeaway">${esc(slide.takeaway)}</p>` : ''}
        </section>`
    }
    case 'cta': {
      const lines = (slide.ctaLines ?? []).map((l) => `<p class="cta-line">${esc(l)}</p>`).join('')
      return `
        <div class="spacer"></div>
        <section class="panel cta" id="fit">
          ${slide.ctaKeyword ? `<p class="cta-keyword">Comment <em>&ldquo;${esc(slide.ctaKeyword)}&rdquo;</em></p>` : ''}
          ${lines}
        </section>`
    }
  }
}

export interface BuildSlideOptions {
  slide: RenderSlide
  skin: Skin
  /** `@font-face` block from lib/render/fonts.ts. */
  fontCss: string
  /** Clinic logo, drawn small in the top-right like the masters do. */
  logoUrl?: string | null
}

export function buildSlideHtml({ slide, skin, fontCss, logoUrl }: BuildSlideOptions): string {
  const photo = slide.shape === 'cover' && !skin.coverPhoto ? null : slide.photoUrl

  return `<!doctype html><html><head><meta charset="utf-8"><style>
${fontCss}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${CANVAS.width}px;height:${CANVAS.height}px}
body{position:relative;overflow:hidden;background:${skin.background};
  font-family:${skin.bodyFamily};-webkit-font-smoothing:antialiased}
.bg{position:absolute;inset:0}
/* Keeps white type legible over any photo without dimming the whole frame —
   the "dark lower third" the photo briefs already ask Flux for. */
.bg-shade{position:absolute;inset:0;background:linear-gradient(180deg,
  rgba(5,13,22,.15) 0%, rgba(5,13,22,.10) 45%, rgba(5,13,22,.55) 100%)}
.frame{position:absolute;inset:0;display:flex;flex-direction:column}
.spacer{flex:1 1 auto;min-height:0}
.chip{position:absolute;top:56px;left:56px;padding:14px 30px;border-radius:999px;
  background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.28);
  color:#fff;font-size:24px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;
  backdrop-filter:blur(2px)}
.logo{position:absolute;top:44px;right:52px;height:56px;opacity:.95}
/* The panel HUGS its content (height:auto, anchored to the bottom). Panels
   therefore differ in height across a post, which POST-CRAFT §4a asks for and
   the Canva runner had to achieve by hand, one resize at a time. */
.panel{flex:0 0 auto;${panelCss(skin)}padding-left:72px;padding-right:72px;padding-bottom:76px}
/* The cover is the one slide that may NOT hug: a title panel over a mostly
   empty dark page reads as a dead void (POST-CRAFT §4a). Give it a floor so
   the brand surface carries the frame, and let it grow past that if the title
   is long. */
.panel.cover{min-height:46%;justify-content:flex-end;display:flex;flex-direction:column}
.title{font-family:${skin.headingFamily};font-style:${skin.headingStyle};
  font-weight:${skin.headingWeight};font-size:96px;line-height:1.04;
  text-transform:${skin.headingTransform};letter-spacing:-.01em}
.hook{margin-top:28px;font-size:${skin.bodySize}px;font-weight:${skin.bodyWeight};line-height:1.38}
.heading{font-family:${skin.headingFamily};font-style:${skin.headingStyle};
  font-weight:${skin.headingWeight};font-size:${skin.headingSize}px;line-height:1.1;
  text-transform:${skin.headingTransform};letter-spacing:-.005em;margin-bottom:26px}
.body{font-size:${skin.bodySize}px;font-weight:${skin.bodyWeight};line-height:1.4}
.lead{margin-bottom:30px}
.items{list-style:none;display:flex;flex-direction:column}
.items li{display:flex;gap:22px;align-items:flex-start;font-size:${skin.bodySize}px;line-height:1.34;
  padding:22px 0;border-top:1px solid ${skin.rule}}
.items li:first-child{border-top:0;padding-top:0}
.marker{flex:0 0 auto;color:${skin.accent};font-weight:600}
.rule{border:0;border-top:1px solid ${skin.rule};width:70%;margin:30px 0 26px}
.takeaway{font-size:${skin.bodySize}px;font-weight:700;line-height:1.32}
.cta{text-align:center;padding-bottom:96px}
.cta-keyword{font-family:${skin.headingFamily};font-style:${skin.headingStyle};font-weight:${skin.headingWeight};
  font-size:52px;line-height:1.2;margin-bottom:24px}
.cta-keyword em{font-style:${skin.headingStyle};text-transform:uppercase}
.cta-line{font-size:32px;line-height:1.42;margin-top:14px;opacity:.95}
</style></head><body>
${photoLayer(photo, skin)}
<div class="frame">${slideBody(slide, skin)}</div>
${logoUrl ? `<img class="logo" src="${logoUrl}" alt="">` : ''}
<script>
// Auto-fit. POST-CRAFT §4a forbids solving overflow by shrinking type, so the
// panel grows first — that is just layout. This only catches the case the rule
// cannot help with: copy so long the grown panel would run off the page. We
// then step the panel's type down by at most 12% and mark the slide, so an
// over-long slide is visible in the result instead of silently clipped.
(function () {
  var panel = document.getElementById('fit')
  if (!panel) { window.__fit = { scale: 1, overflow: false }; return }
  var limit = ${CANVAS.height} - 96
  var scale = 1
  // zoom (not font-size): the children carry absolute px sizes, so only a
  // zoom scales the whole panel — type, padding and the diagonal cut together.
  while (panel.getBoundingClientRect().height > limit && scale > 0.88) {
    scale -= 0.02
    panel.style.zoom = String(scale)
  }
  window.__fit = { scale: scale, overflow: panel.getBoundingClientRect().height > limit }
})()
</script>
</body></html>`
}
