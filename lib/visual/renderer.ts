import type { VisualStyle } from '@/types'
import { buildSlideHTML } from './templates'

// Dynamic import so the Next bundler does not include puppeteer in the
// client bundle or the Edge runtime. This module is server-only.
async function launchBrowser() {
  const puppeteer = (await import('puppeteer')).default
  return puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true,
  })
}

export interface RenderSlideInput {
  text: string
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
    const html = buildSlideHTML(input.text, input.photoUrl, input.style, {
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

// Render multiple slides sharing a single browser process.
export async function renderSlides(
  slides: Array<{ text: string; photoUrl: string | null }>,
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
      const html = buildSlideHTML(s.text, s.photoUrl, style, {
        slideIndex: i,
        slideTotal: slides.length,
      })
      await page.setContent(html, { waitUntil: 'networkidle0' })
      const shot = await page.screenshot({ type: 'png', omitBackground: false })
      out.push(Buffer.from(shot))
    }
    return out
  } finally {
    await browser.close()
  }
}
