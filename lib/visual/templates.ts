import type { VisualStyle } from '@/types'

// Build a self-contained HTML document that renders to a single slide canvas.
// No external assets except the optional background photo URL. Kept as pure
// strings so it can be rendered by Puppeteer or previewed in a browser.
export function buildSlideHTML(
  text: string,
  photoUrl: string | null,
  style: VisualStyle,
  opts: { slideIndex?: number; slideTotal?: number } = {}
): string {
  const { canvas, background, text: textStyle, logo, padding } = style
  const escapedText = escapeHtml(text)
  const overlay = background.type === 'photo' && photoUrl ? background.overlay_opacity : 0
  const bgLayer = buildBackgroundCss(background.type, photoUrl)
  const position = textStyle.primary.position

  const slideCounter =
    typeof opts.slideIndex === 'number' && typeof opts.slideTotal === 'number'
      ? `<div class="counter">${opts.slideIndex + 1} / ${opts.slideTotal}</div>`
      : ''

  const logoEl =
    logo.url && logo.url.trim().length > 0
      ? `<img class="logo" src="${escapeAttr(logo.url)}" alt="" />`
      : ''

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; width: ${canvas.width}px; height: ${canvas.height}px; }
  body {
    position: relative;
    width: ${canvas.width}px;
    height: ${canvas.height}px;
    font-family: ${escapeCss(textStyle.primary.font)}, -apple-system, 'Helvetica Neue', Arial, sans-serif;
    color: ${escapeCss(textStyle.primary.color)};
    overflow: hidden;
    ${bgLayer}
  }
  .overlay {
    position: absolute; inset: 0;
    background: rgba(0,0,0,${overlay.toFixed(3)});
  }
  .frame {
    position: absolute; inset: 0;
    padding: ${padding}px;
    display: flex;
    flex-direction: column;
    justify-content: ${
      position === 'top' ? 'flex-start' : position === 'bottom' ? 'flex-end' : 'center'
    };
    align-items: center;
    text-align: center;
  }
  .text {
    font-size: ${textStyle.primary.size}px;
    line-height: 1.2;
    font-weight: 600;
    color: ${escapeCss(textStyle.primary.color)};
    white-space: pre-wrap;
    max-width: 100%;
    text-shadow: ${background.type === 'photo' ? '0 2px 12px rgba(0,0,0,0.35)' : 'none'};
  }
  .logo {
    position: absolute;
    ${cornerCss(logo.position)}
    width: ${logo.size}px;
    height: auto;
  }
  .counter {
    position: absolute;
    bottom: 24px; right: 24px;
    font-size: ${Math.max(14, textStyle.secondary.size / 2)}px;
    color: ${escapeCss(textStyle.secondary.color)};
    font-family: ${escapeCss(textStyle.secondary.font)}, -apple-system, sans-serif;
    opacity: 0.75;
  }
</style>
</head>
<body>
  ${background.type === 'photo' && photoUrl && overlay > 0 ? '<div class="overlay"></div>' : ''}
  <div class="frame">
    <div class="text">${escapedText}</div>
  </div>
  ${logoEl}
  ${slideCounter}
</body>
</html>`
}

function buildBackgroundCss(
  type: VisualStyle['background']['type'],
  photoUrl: string | null
): string {
  if (type === 'photo' && photoUrl) {
    return `background: url('${escapeCss(photoUrl)}') center/cover no-repeat #0a0a0a;`
  }
  return `background: #ffffff;`
}

function cornerCss(position: string): string {
  switch (position) {
    case 'top-left':
      return 'top: 32px; left: 32px;'
    case 'top-right':
      return 'top: 32px; right: 32px;'
    case 'bottom-left':
      return 'bottom: 32px; left: 32px;'
    case 'bottom-right':
    default:
      return 'bottom: 32px; right: 32px;'
  }
}

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
