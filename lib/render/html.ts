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

/** Brush underline. The script parks it under the title's real last line. */
function brushUnderline(color: string): string {
  return `<svg class="doodle brush" viewBox="0 0 600 52" preserveAspectRatio="none"
    style="width:600px;height:52px">
    <path d="M4 40 C 140 14, 330 10, 596 22" stroke="${color}" stroke-width="13"
      stroke-linecap="round" fill="none"/></svg>`
}

// ── The chain ───────────────────────────────────────
// ONE wave drawn across the WHOLE carousel, not a doodle per slide.
//
// Think of the six slides as a single 6480px-wide sheet. The line is a
// sine over that sheet; each slide renders its own 1080px window of it.
// Two things fall out for free, which is why it is done this way:
//   · the line never breaks — the y at a slide's right edge IS the y at
//     the next slide's left edge, because it is the same function;
//   · it rides up and down as you swipe, since a slide shows a little
//     over half a period.
// Nothing here is random: the same page number always yields the same
// window of the same wave.
const WAVE = { base: 1104, amp: 54, lambda: 1730 }

function waveY(globalX: number): number {
  return WAVE.base + WAVE.amp * Math.sin((2 * Math.PI * globalX) / WAVE.lambda)
}

/**
 * The slide's window of the wave. `head` draws the arrow that hands the eye
 * to the next slide — the last slide receives the line and keeps it.
 */
function chainWave(color: string, page: number, head: boolean): string {
  const originX = (page - 1) * CANVAS.width
  // The head is where the line STOPS. Drawing dashes past it left a stub
  // poking out of the triangle, which is what made the seam look broken.
  const hx = CANVAS.width - 96
  const step = 16
  const last = head ? hx - 30 : CANVAS.width + 60
  const pts: string[] = []
  for (let x = -60; x <= last; x += step) {
    pts.push(`${x} ${waveY(originX + x).toFixed(1)}`)
  }
  const d = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p).join(' ')

  // The head sits ON the line and leans along it, so it reads as the tip of
  // the stroke rather than a triangle parked nearby.
  const y1 = waveY(originX + hx - 12)
  const y2 = waveY(originX + hx + 12)
  const angle = (Math.atan2(y2 - y1, 24) * 180) / Math.PI
  const arrow = head
    ? `<g transform="translate(${hx} ${waveY(originX + hx).toFixed(1)}) rotate(${angle.toFixed(2)})">
         <path d="M-26 -26 L32 0 L-26 26 Z" fill="${color}"/></g>`
    : ''

  return `<svg class="doodle" viewBox="0 0 ${CANVAS.width} ${CANVAS.height}"
    style="left:0;top:0;width:${CANVAS.width}px;height:${CANVAS.height}px">
    <path d="${d}" stroke="${color}" stroke-width="12" stroke-linecap="round"
      stroke-dasharray="26 30" fill="none"/>${arrow}</svg>`
}

/**
 * The signal arcs in the bottom-left corner of the cover — the "ringing"
 * mark from the master. Concentric quarter-arcs centred on the corner
 * itself, so they read as something radiating in from off-frame rather
 * than a badge stuck on the page.
 */
function signalArcs(): string {
  const RINGS = [
    { r: 150, w: 44, c: '#b9b2dd' },
    { r: 250, w: 46, c: '#c7c1e6' },
    { r: 352, w: 44, c: '#aca4d3' },
  ]
  const arcs = RINGS.map(({ r, w, c }) => {
    // Quarter arc from due-east of the corner round to due-north.
    const d = `M ${r} ${CANVAS.height} A ${r} ${r} 0 0 0 0 ${CANVAS.height - r}`
    return `<path d="${d}" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`
  }).join('')
  return `<svg class="doodle" viewBox="0 0 ${CANVAS.width} ${CANVAS.height}"
    style="left:0;top:0;width:${CANVAS.width}px;height:${CANVAS.height}px">${arcs}</svg>`
}

/** Save-this-post bookmark, sitting beside the CTA title. */
function bookmark(color: string): string {
  return `<svg class="doodle" viewBox="0 0 108 128"
    style="left:790px;top:470px;width:108px;height:128px">
    <path d="M12 8 H96 V120 L54 88 L12 120 Z" stroke="${color}" stroke-width="9"
      fill="none" stroke-linejoin="round"/></svg>`
}

function paperDoodles(slide: RenderSlide, skin: Skin): string {
  if (!skin.doodles) return ''
  const c = skin.highlight ?? skin.accent
  switch (slide.shape) {
    // The cover starts the chain; nothing arrives into it.
    case 'cover':
      return signalArcs() + brushUnderline(c) + chainWave(c, slide.page, true)
    // The CTA ends it: the line arrives and stops at the bookmark.
    case 'cta':
      return chainWave(c, slide.page, false) + bookmark(c)
    default:
      return chainWave(c, slide.page, true)
  }
}

function paperSlideBody(slide: RenderSlide, skin: Skin): string {
  const heading = slide.heading ? esc(slide.heading) : ''
  switch (slide.shape) {
    case 'cover':
      return `
        ${slide.chip ? `<div class="p-eyebrow" id="eyebrow">${esc(slide.chip)}</div>` : ''}
        <h1 class="p-cover" id="fit-title">${heading}</h1>
        `
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
.brush{visibility:hidden}
.logo{position:absolute;top:83px;right:64px;width:132px;height:132px;object-fit:contain}
.handle{position:absolute;left:114px;top:1201px;font-size:35px;color:#161616;letter-spacing:.01em}
/* Titles are anchored, not centred: the cover reads up from the underline,
   body slides hang from the top. Sizes mirror the master (150 / 112 / 107). */
/* One word over the headline. The gradient runs through the glyphs
   themselves (background-clip:text), light at the top edge into full ink —
   so it reads as the word surfacing out of the paper rather than as a
   coloured label. */
/* The kicker is handwritten, not set in caps: on the cover it reads as an
   address to the reader ("Doctor"), and the silver gradient keeps it behind
   the headline in the hierarchy instead of competing with it. */
.p-eyebrow{position:absolute;left:104px;top:0;visibility:hidden;
  font-family:'Great Vibes', cursive;font-weight:400;font-size:132px;
  line-height:1;letter-spacing:.01em;padding:0 18px 18px 0;
  background:linear-gradient(168deg,#e2ded6 0%,#a49c8d 38%,#6f6759 68%,#453f38 100%);
  -webkit-background-clip:text;background-clip:text;color:transparent}
.p-cover{position:absolute;left:108px;width:864px;bottom:420px;
  font-family:${skin.headingFamily};font-weight:${skin.headingWeight};
  text-transform:${skin.headingTransform};font-size:150px;line-height:.92;letter-spacing:-.015em}
.p-heading{position:absolute;left:180px;right:120px;top:330px;
  font-family:${skin.headingFamily};font-weight:${skin.headingWeight};
  text-transform:${skin.headingTransform};font-size:${skin.headingSize}px;line-height:.92;letter-spacing:-.015em}
.p-cta{position:absolute;left:180px;width:640px;top:520px;
  font-family:${skin.headingFamily};font-weight:${skin.headingWeight};
  text-transform:${skin.headingTransform};font-size:107px;line-height:.92;letter-spacing:-.015em}
.p-body{position:absolute;left:180px;width:660px;top:652px;
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
    while (body.getBoundingClientRect().bottom > 1040 && bscale > 0.74) {
      bscale -= 0.03
      body.style.fontSize = (bsize * bscale) + 'px'
    }
    scale = Math.min(scale, bscale)
  }
  // The brush belongs to the title, so it is parked under the title's real
  // last line rather than at a guessed y — that is what kept it off the
  // words when a cover ran one line longer than planned.
  var eyebrow = document.getElementById('eyebrow')
  if (eyebrow && title) {
    var tr = title.getBoundingClientRect()
    eyebrow.style.top = (tr.top - eyebrow.getBoundingClientRect().height + 26) + 'px'
    eyebrow.style.visibility = 'visible'
  }
  var brush = document.querySelector('.brush')
  if (brush && title) {
    var tb = title.getBoundingClientRect()
    brush.style.left = tb.left + 'px'
    brush.style.top = (tb.bottom + 10) + 'px'
    brush.style.width = Math.min(620, Math.max(300, tb.width * 0.72)) + 'px'
    brush.style.visibility = 'visible'
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
