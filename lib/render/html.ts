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

function slideBody(slide: RenderSlide): string {
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

// ── Paper surface (Style 6) ──────────────────────────────────────────
//
// Same contract as the panel path — a RenderSlide in, one 1080×1350 page
// out — but the page is paper, the type is black, and the paragraph gets a
// stepped inline highlight instead of sitting on a panel. The stepped edge
// is `box-decoration-break: clone`, which follows the real line breaks; the
// Canva master had to be nudged by hand every time the copy changed.
//
// Everything is drawn, nothing is fetched: the texture is an SVG turbulence
// filter and the doodles are inline paths, so a render needs no binary asset
// and cannot drift when an asset is re-exported.

/** Warm paper: flat tint plus a faint noise wash, both generated. */
function paperTexture(tint: string): string {
  const noise =
    `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>` +
    `<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/>` +
    `<feColorMatrix type='saturate' values='0'/></filter>` +
    `<rect width='300' height='300' filter='url(%23n)' opacity='0.38'/></svg>`
  return (
    `background-color:${tint};` +
    `background-image:url("data:image/svg+xml;utf8,${noise}");` +
    `background-size:300px 300px;background-blend-mode:multiply`
  )
}

/** Brush underline that sits under the cover title. */
function brushUnderline(color: string, left: number, top: number, width: number): string {
  return `<svg class="doodle" viewBox="0 0 600 52" preserveAspectRatio="none"
    style="left:${left}px;top:${top}px;width:${width}px;height:52px">
    <path d="M4 40 C 140 14, 330 10, 596 22" stroke="${color}" stroke-width="13"
      stroke-linecap="round" fill="none"/></svg>`
}

/** Dashed arc with an arrow head — the master's travelling dotted line. */
function dottedArrow(color: string, opts: { left: number; top: number; flip: boolean }): string {
  const t = opts.flip ? 'scale(-1,1) translate(-430,0)' : ''
  return `<svg class="doodle" viewBox="0 0 430 190"
    style="left:${opts.left}px;top:${opts.top}px;width:430px;height:190px">
    <g transform="${t}">
      <path d="M10 150 C 90 150, 150 70, 250 46" stroke="${color}" stroke-width="12"
        stroke-linecap="round" stroke-dasharray="26 30" fill="none"/>
      <path d="M244 12 L300 46 L244 78 Z" fill="${color}"/>
    </g></svg>`
}

/** Save-this-post bookmark, drawn next to the CTA line. */
function bookmark(color: string, left: number, top: number): string {
  return `<svg class="doodle" viewBox="0 0 108 128"
    style="left:${left}px;top:${top}px;width:108px;height:128px">
    <path d="M12 8 H96 V120 L54 88 L12 120 Z" stroke="${color}" stroke-width="9"
      fill="none" stroke-linejoin="round"/></svg>`
}

function paperDoodles(slide: RenderSlide, skin: Skin): string {
  if (!skin.doodles) return ''
  const c = skin.highlight ?? skin.accent
  // Alternate the side by page so a swipe does not repeat the same corner.
  const flip = slide.page % 2 === 0
  switch (slide.shape) {
    case 'cover':
      return dottedArrow(c, { left: 700, top: 980, flip: false })
    case 'cta':
      return (
        dottedArrow(c, { left: -40, top: 560, flip: false }) +
        bookmark(c, 760, 470)
      )
    default:
      return (
        dottedArrow(c, { left: flip ? 720 : 700, top: 560, flip }) +
        dottedArrow(c, { left: flip ? -120 : -140, top: 700, flip: !flip })
      )
  }
}

function paperSlideBody(slide: RenderSlide, skin: Skin): string {
  const heading = slide.heading ? esc(slide.heading) : ''
  switch (slide.shape) {
    case 'cover':
      return `
        <h1 class="p-cover" id="fit-title">${heading}</h1>
        ${skin.doodles ? brushUnderline(skin.highlight ?? skin.accent, 108, 946, 600) : ''}`
    case 'cta':
      return `<h1 class="p-cta" id="fit-title">${heading}</h1>`
    default: {
      // Bullets have no home in this master — it carries one paragraph per
      // slide. A list arrives as its items joined, so nothing is dropped.
      const text = slide.body?.trim() || (slide.items ?? []).join(' ')
      return `
        <h2 class="p-heading" id="fit-title">${heading}</h2>
        ${text ? `<p class="p-body" id="fit-body"><span class="hl">${esc(text)}</span></p>` : ''}`
    }
  }
}

function buildPaperHtml({ slide, skin, fontCss, logoUrl, handle }: BuildSlideOptions): string {
  const ink = skin.ink ?? '#050505'
  const tint = skin.paperTint ?? skin.background

  return `<!doctype html><html><head><meta charset="utf-8"><style>
${fontCss}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${CANVAS.width}px;height:${CANVAS.height}px}
body{position:relative;overflow:hidden;${paperTexture(tint)};
  font-family:${skin.bodyFamily};color:${ink};-webkit-font-smoothing:antialiased}
.doodle{position:absolute;overflow:visible}
.logo{position:absolute;top:83px;right:64px;width:132px;height:132px;object-fit:contain}
.handle{position:absolute;left:114px;top:1201px;font-size:35px;color:#161616;letter-spacing:.01em}
/* Titles are anchored, not centred: the cover reads up from the underline,
   body slides hang from the top. Sizes mirror the master (150 / 112 / 107). */
.p-cover{position:absolute;left:108px;width:864px;bottom:420px;
  font-family:${skin.headingFamily};font-weight:${skin.headingWeight};
  text-transform:${skin.headingTransform};font-size:150px;line-height:.92;letter-spacing:-.015em}
.p-heading{position:absolute;left:180px;right:120px;top:330px;
  font-family:${skin.headingFamily};font-weight:${skin.headingWeight};
  text-transform:${skin.headingTransform};font-size:${skin.headingSize}px;line-height:.92;letter-spacing:-.015em}
.p-cta{position:absolute;left:180px;width:640px;top:520px;
  font-family:${skin.headingFamily};font-weight:${skin.headingWeight};
  text-transform:${skin.headingTransform};font-size:107px;line-height:.92;letter-spacing:-.015em}
.p-body{position:absolute;left:180px;width:660px;top:760px;
  font-size:${skin.bodySize}px;font-weight:${skin.bodyWeight};line-height:1.74}
/* The stepped highlight: 'clone' repeats the padding on every wrapped line,
   which is exactly the ragged block the master draws by hand. */
.hl{display:inline;background:${skin.highlight ?? skin.accent};color:${skin.highlightInk ?? '#fff'};
  padding:4px 11px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
</style></head><body>
${paperDoodles(slide, skin)}
${paperSlideBody(slide, skin)}
${logoUrl ? `<img class="logo" src="${logoUrl}" alt="">` : ''}
${handle ? `<div class="handle">${esc(handle)}</div>` : ''}
<script>
// Fit by LINE COUNT, which is what actually breaks this master. Canva locked
// the size, so an over-long title silently ran into the underline (caught on
// the 2026-09-17 batch: a 20-character title took four lines). Here the type
// steps down until the title is within its line budget and the paragraph is
// clear of the footer — visible, bounded, and recorded in __fit.
(function () {
  var title = document.getElementById('fit-title')
  var body = document.getElementById('fit-body')
  var scale = 1
  function lines(el) {
    var lh = parseFloat(getComputedStyle(el).lineHeight)
    return Math.round(el.getBoundingClientRect().height / lh)
  }
  if (title) {
    var budget = title.classList.contains('p-heading') ? 3 : 4
    var size = parseFloat(getComputedStyle(title).fontSize)
    while (lines(title) > budget && scale > 0.7) {
      scale -= 0.04
      title.style.fontSize = (size * scale) + 'px'
    }
  }
  if (body) {
    var bsize = parseFloat(getComputedStyle(body).fontSize)
    var bscale = 1
    while (body.getBoundingClientRect().bottom > 1150 && bscale > 0.78) {
      bscale -= 0.03
      body.style.fontSize = (bsize * bscale) + 'px'
    }
    scale = Math.min(scale, bscale)
  }
  window.__fit = { scale: scale, overflow: scale <= 0.7 }
})()
</script>
</body></html>`
}

export interface BuildSlideOptions {
  slide: RenderSlide
  skin: Skin
  /** `@font-face` block from lib/render/fonts.ts. */
  fontCss: string
  /** Clinic logo, drawn small in the top-right like the masters do. */
  logoUrl?: string | null
  /** Footer handle on the paper surface, e.g. `@yedino.systems`. */
  handle?: string | null
}

export function buildSlideHtml(opts: BuildSlideOptions): string {
  // One token decides the surface; everything below is the panel path.
  if (opts.skin.surface === 'paper') return buildPaperHtml(opts)
  const { slide, skin, fontCss, logoUrl } = opts
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
<div class="frame">${slideBody(slide)}</div>
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
