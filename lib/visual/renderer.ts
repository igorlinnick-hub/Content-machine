import type { Browser } from 'puppeteer-core'
import type { VisualStyle, TypedSlide } from '@/types'
import { buildSlideHTML } from './templates'

// Detect serverless / Lambda-style environments. Vercel sets both
// VERCEL=1 and AWS_LAMBDA_FUNCTION_NAME at runtime; the latter is
// the canonical "we're inside Lambda" signal that matches what
// @sparticuz/chromium expects.
function isServerless(): boolean {
  return Boolean(
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.VERCEL ||
      process.env.NETLIFY
  )
}

async function launchBrowser(): Promise<Browser> {
  if (isServerless()) {
    const chromium = (await import('@sparticuz/chromium')).default
    const puppeteer = await import('puppeteer-core')
    const executablePath = await chromium.executablePath()
    return puppeteer.launch({
      args: chromium.args,
      executablePath,
      headless: true,
    }) as unknown as Browser
  }

  // Local / dev: full puppeteer is in devDependencies. Importing it
  // dynamically keeps it out of the production bundle.
  const puppeteer = await import('puppeteer')
  return puppeteer.default.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true,
  }) as unknown as Browser
}

export interface RenderSlideInput {
  // Either a plain string (legacy) or a typed slide. Renderer dispatches
  // to cover/body/cta layouts based on TypedSlide.kind. Strings get a
  // positional fallback (handled inside buildSlideHTML / coerceSlides).
  slide: TypedSlide | string
  photoUrl: string | null
  style: VisualStyle
  slideIndex?: number
  slideTotal?: number
}

export async function renderSlide(input: RenderSlideInput): Promise<Buffer> {
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    await page.setViewport({
      width: input.style.canvas.width,
      height: input.style.canvas.height,
      deviceScaleFactor: 1,
    })
    const html = buildSlideHTML(input.slide, input.photoUrl, input.style, {
      slideIndex: input.slideIndex,
      slideTotal: input.slideTotal,
    })
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const shot = await page.screenshot({ type: 'png', omitBackground: false })
    return Buffer.from(shot)
  } finally {
    await browser.close()
  }
}

// Render multiple slides sharing a single browser process. Each entry
// carries the slide payload (string or typed) and an optional photo URL.
export async function renderSlides(
  slides: Array<{ slide: TypedSlide | string; photoUrl: string | null }>,
  style: VisualStyle
): Promise<Buffer[]> {
  if (slides.length === 0) return []
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    await page.setViewport({
      width: style.canvas.width,
      height: style.canvas.height,
      deviceScaleFactor: 1,
    })
    const out: Buffer[] = []
    for (let i = 0; i < slides.length; i += 1) {
      const s = slides[i]
      const html = buildSlideHTML(s.slide, s.photoUrl, style, {
        slideIndex: i,
        slideTotal: slides.length,
      })
      await page.setContent(html, { waitUntil: 'load', timeout: 15000 })
      const shot = await page.screenshot({ type: 'png', omitBackground: false })
      out.push(Buffer.from(shot))
    }
    return out
  } finally {
    await browser.close()
  }
}
