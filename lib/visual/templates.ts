import type { VisualStyle, TypedSlide, SlideKind } from '@/types'

// Default fallback brand for legacy slide_sets that pre-date the typed
// renderer. Mirrors HWC reference tokens.
const FALLBACK_BRAND = {
  primary: '#1e3a8a',
  accent: '#3b82f6',
  surface: '#ffffff',
  surface_text: '#1e3a8a',
  card_text: '#ffffff',
}

function brandOf(style: VisualStyle) {
  return style.brand ?? FALLBACK_BRAND
}

// Coerce a legacy string slide into a TypedSlide using positional rules:
// first slide = cover, last = cta, anything in between = body.
export function coerceSlides(
  raw: Array<string | TypedSlide>
): TypedSlide[] {
  const total = raw.length
  return raw.map((s, i): TypedSlide => {
    if (typeof s !== 'string') return s
    const kind: SlideKind = i === 0 ? 'cover' : i === total - 1 ? 'cta' : 'body'
    return { kind, text: s }
  })
}

// Public API. Builds a self-contained HTML document for one slide based on
// its kind. Photo URL is optional — body/cta fall back to brand-coloured
// surface, cover always uses the white surface with sky gradient.
export function buildSlideHTML(
  slide: TypedSlide | string,
  photoUrl: string | null,
  style: VisualStyle,
  opts: { slideIndex?: number; slideTotal?: number } = {}
): string {
  const typed: TypedSlide =
    typeof slide === 'string'
      ? coerceSlides([slide])[0]
      : slide

  switch (typed.kind) {
    case 'cover':
      return buildCoverHTML(typed, style, opts)
    case 'cta':
      return buildCtaHTML(typed, photoUrl, style, opts)
    case 'body':
    default:
      return buildBodyHTML(typed, photoUrl, style, opts)
  }
}

// ─── COVER ───────────────────────────────────────────────────────────────
// White bg, sky radial gradient top-right, eyebrow chip, big bold all-caps
// headline, smaller all-caps subhead. No photo, no logo (intentionally clean).
function buildCoverHTML(
  slide: TypedSlide,
  style: VisualStyle,
  _opts: { slideIndex?: number; slideTotal?: number }
): string {
  const { canvas, padding } = style
  const brand = brandOf(style)
  const font = style.text.primary.font

  // Cover text decomposition: if subtext is provided, use as-is. Otherwise
  // try to pull a headline / subhead pair out of the text by splitting on
  // " — " or first sentence boundary.
  const eyebrow = (slide.chip ?? '').trim()
  let headline = slide.text.trim()
  let subhead = (slide.subtext ?? '').trim()

  if (!subhead && headline.includes(' — ')) {
    const [h, ...rest] = headline.split(' — ')
    headline = h.trim()
    subhead = rest.join(' — ').trim()
  } else if (!subhead) {
    // No explicit subhead and no em-dash: keep the whole text as headline.
  }

  return `<!doctype html>
<html><head><meta charset="utf-8" /><style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${canvas.width}px; height: ${canvas.height}px; }
  body {
    position: relative;
    width: ${canvas.width}px; height: ${canvas.height}px;
    font-family: ${escapeCss(font)}, -apple-system, 'Helvetica Neue', Arial, sans-serif;
    background: ${escapeCss(brand.surface)};
    color: ${escapeCss(brand.surface_text)};
    overflow: hidden;
  }
  .glow {
    position: absolute; top: -25%; right: -20%;
    width: 80%; height: 80%;
    background: radial-gradient(closest-side, ${escapeCss(brand.accent)}55, transparent 70%);
    pointer-events: none;
  }
  .glow-bottom {
    position: absolute; bottom: -25%; left: -25%;
    width: 70%; height: 70%;
    background: radial-gradient(closest-side, ${escapeCss(brand.accent)}33, transparent 70%);
    pointer-events: none;
  }
  .frame {
    position: absolute; inset: 0;
    padding: ${padding}px;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    text-align: center;
  }
  .eyebrow {
    font-size: 28px;
    font-weight: 700;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: ${escapeCss(brand.surface_text)};
    margin-bottom: 56px;
  }
  .headline {
    font-size: 96px;
    font-weight: 800;
    line-height: 1.05;
    text-transform: uppercase;
    letter-spacing: -0.01em;
    color: ${escapeCss(brand.surface_text)};
    max-width: 100%;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .subhead {
    margin-top: 64px;
    font-size: 22px;
    font-weight: 600;
    line-height: 1.45;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: ${escapeCss(brand.surface_text)};
    max-width: 60%;
    opacity: 0.85;
    white-space: pre-wrap;
  }
</style></head><body>
  <div class="glow"></div>
  <div class="glow-bottom"></div>
  <div class="frame">
    ${eyebrow ? `<div class="eyebrow">${escapeHtml(eyebrow)}</div>` : ''}
    <div class="headline">${escapeHtml(headline)}</div>
    ${subhead ? `<div class="subhead">${escapeHtml(subhead)}</div>` : ''}
  </div>
</body></html>`
}

// ─── BODY ────────────────────────────────────────────────────────────────
// Photo bg (or brand-coloured fallback), navy chip card on top, navy body
// card on bottom. Logo small in bottom-right of the photo area.
function buildBodyHTML(
  slide: TypedSlide,
  photoUrl: string | null,
  style: VisualStyle,
  _opts: { slideIndex?: number; slideTotal?: number }
): string {
  const { canvas, padding, logo } = style
  const brand = brandOf(style)
  const font = style.text.primary.font
  const bgCss = photoUrl
    ? `background: url('${escapeCss(photoUrl)}') center/cover no-repeat ${escapeCss(brand.primary)};`
    : `background: ${escapeCss(brand.primary)};`

  const chip = (slide.chip ?? '').trim()
  const chipQuote = (slide.subtext ?? '').trim()
  const body = slide.text.trim()

  const logoEl =
    logo.url && logo.url.trim().length > 0
      ? `<img class="logo" src="${escapeAttr(logo.url)}" alt="" />`
      : ''

  return `<!doctype html>
<html><head><meta charset="utf-8" /><style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${canvas.width}px; height: ${canvas.height}px; }
  body {
    position: relative;
    width: ${canvas.width}px; height: ${canvas.height}px;
    font-family: ${escapeCss(font)}, -apple-system, 'Helvetica Neue', Arial, sans-serif;
    color: ${escapeCss(brand.card_text)};
    overflow: hidden;
    ${bgCss}
  }
  .top-card {
    position: absolute;
    top: ${padding}px;
    left: ${padding}px; right: ${padding}px;
    background: ${escapeCss(brand.primary)};
    border-radius: 20px;
    padding: 32px 40px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.18);
  }
  .chip {
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: ${escapeCss(brand.card_text)};
    margin-bottom: 12px;
    opacity: 0.9;
  }
  .chip-quote {
    font-size: 30px;
    font-weight: 700;
    line-height: 1.25;
    color: ${escapeCss(brand.card_text)};
    font-style: italic;
  }
  .body-card {
    position: absolute;
    bottom: ${padding}px;
    left: ${padding}px; right: ${padding}px;
    background: ${escapeCss(brand.primary)};
    border-radius: 20px;
    padding: 40px 44px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.18);
  }
  .body {
    font-size: 24px;
    font-weight: 700;
    line-height: 1.45;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${escapeCss(brand.card_text)};
    text-align: center;
    white-space: pre-wrap;
  }
  .logo {
    position: absolute;
    bottom: ${padding + 8}px;
    right: ${padding + 8}px;
    width: ${Math.max(64, logo.size)}px;
    height: auto;
    z-index: 5;
    opacity: 0;
  }
</style></head><body>
  ${(chip || chipQuote)
    ? `<div class="top-card">
        ${chip ? `<div class="chip">${escapeHtml(chip)}</div>` : ''}
        ${chipQuote ? `<div class="chip-quote">${escapeHtml(chipQuote)}</div>` : ''}
      </div>`
    : ''}
  <div class="body-card">
    <div class="body">${escapeHtml(body)}</div>
  </div>
  ${logoEl}
</body></html>`
}

// ─── CTA ─────────────────────────────────────────────────────────────────
// Photo bg (typically team photo), single navy card at the bottom with
// headline + body line + action line. Logo bottom-center small.
function buildCtaHTML(
  slide: TypedSlide,
  photoUrl: string | null,
  style: VisualStyle,
  _opts: { slideIndex?: number; slideTotal?: number }
): string {
  const { canvas, padding, logo } = style
  const brand = brandOf(style)
  const font = style.text.primary.font
  const bgCss = photoUrl
    ? `background: url('${escapeCss(photoUrl)}') center/cover no-repeat ${escapeCss(brand.primary)};`
    : `background: ${escapeCss(brand.primary)};`

  // CTA structure:
  //   chip (optional eyebrow like "STILL HAVE QUESTIONS?")
  //   subtext (optional middle line)
  //   text (action — "BOOK A CONSULTATION — LINK IN BIO.")
  const headline = (slide.chip ?? '').trim()
  const middle = (slide.subtext ?? '').trim()
  const action = slide.text.trim()

  const logoEl =
    logo.url && logo.url.trim().length > 0
      ? `<img class="logo" src="${escapeAttr(logo.url)}" alt="" />`
      : ''

  return `<!doctype html>
<html><head><meta charset="utf-8" /><style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${canvas.width}px; height: ${canvas.height}px; }
  body {
    position: relative;
    width: ${canvas.width}px; height: ${canvas.height}px;
    font-family: ${escapeCss(font)}, -apple-system, 'Helvetica Neue', Arial, sans-serif;
    color: ${escapeCss(brand.card_text)};
    overflow: hidden;
    ${bgCss}
  }
  .card {
    position: absolute;
    bottom: ${padding}px;
    left: ${padding}px; right: ${padding}px;
    background: ${escapeCss(brand.primary)};
    border-radius: 20px;
    padding: 56px 48px 64px;
    text-align: center;
    box-shadow: 0 8px 32px rgba(0,0,0,0.22);
  }
  .cta-headline {
    font-size: 38px;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    line-height: 1.2;
    color: ${escapeCss(brand.card_text)};
    margin-bottom: 24px;
  }
  .cta-middle {
    font-size: 22px;
    font-weight: 600;
    line-height: 1.45;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.85;
    color: ${escapeCss(brand.card_text)};
    margin-bottom: 28px;
    white-space: pre-wrap;
  }
  .cta-action {
    font-size: 26px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: ${escapeCss(brand.card_text)};
    line-height: 1.3;
    white-space: pre-wrap;
  }
  .logo {
    position: absolute;
    bottom: 24px; left: 50%;
    transform: translateX(-50%);
    width: ${Math.max(80, logo.size)}px;
    height: auto;
    opacity: 0;
  }
</style></head><body>
  <div class="card">
    ${headline ? `<div class="cta-headline">${escapeHtml(headline)}</div>` : ''}
    ${middle ? `<div class="cta-middle">${escapeHtml(middle)}</div>` : ''}
    <div class="cta-action">${escapeHtml(action)}</div>
  </div>
  ${logoEl}
</body></html>`
}

// ─── helpers ─────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeAttr(s: string): string {
  return escapeHtml(s)
}

function escapeCss(s: string): string {
  return s.replace(/["'\\]/g, '')
}
