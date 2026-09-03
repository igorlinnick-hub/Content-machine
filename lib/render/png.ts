import { CANVAS } from './types'

// HTML → PNG through headless Chromium. The serverless/local branch is the
// same one lib/content-plan/pdf.ts already runs in production for the plan
// PDF; puppeteer-core and @sparticuz/chromium are marked external in
// next.config.mjs, so nothing new has to be wired for the bundle.

export interface RenderedPage {
  page: number
  png: Buffer
  /** True when the copy was too long even after the bounded auto-fit. */
  overflow: boolean
  /** Auto-fit scale that was needed; 1 means the panel fit as designed. */
  scale: number
}

// puppeteer and puppeteer-core ship structurally identical but nominally
// different Page types, and a union of the two is not callable. We only use
// three methods, so state them and let each branch satisfy this shape.
interface PageLike {
  setContent(html: string, opts: { waitUntil: string[] }): Promise<unknown>
  evaluate(pageFunction: string): Promise<unknown>
  screenshot(opts: { type: 'png' }): Promise<Uint8Array>
}
interface BrowserLike {
  newPage(): Promise<PageLike>
  close(): Promise<void>
}

function isServerless(): boolean {
  return !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME
}

async function launchBrowser(): Promise<BrowserLike> {
  // deviceScaleFactor 2 → 2160×2700 PNGs. Instagram downscales, and type
  // rendered at 2× is visibly crisper than a 1080-wide screenshot.
  const viewport = { width: CANVAS.width, height: CANVAS.height, deviceScaleFactor: 2 }
  if (isServerless()) {
    const chromium = (await import('@sparticuz/chromium')).default
    const puppeteer = await import('puppeteer-core')
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: viewport,
      executablePath: await chromium.executablePath(),
      headless: true,
    })
    return browser as unknown as BrowserLike
  }
  const puppeteer = await import('puppeteer')
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: viewport,
    headless: true,
  })
  return browser as unknown as BrowserLike
}

/**
 * Renders every page in one browser. Pages are drawn sequentially in a single
 * tab — a carousel is 7-8 pages, and reusing the tab keeps the whole set well
 * under the route's time budget while avoiding N Chromium cold starts.
 */
export async function renderPages(htmls: string[]): Promise<RenderedPage[]> {
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    const out: RenderedPage[] = []
    for (let i = 0; i < htmls.length; i++) {
      // networkidle0: the photos are remote URLs (Replicate/Pexels/Supabase)
      // and a screenshot taken before they land is a slide with a hole in it.
      await page.setContent(htmls[i], { waitUntil: ['load', 'networkidle0'] })
      const fit = (await page.evaluate('window.__fit')) as
        | { scale: number; overflow: boolean }
        | undefined
      const shot = await page.screenshot({ type: 'png' })
      out.push({
        page: i + 1,
        png: Buffer.from(shot),
        overflow: fit?.overflow ?? false,
        scale: fit?.scale ?? 1,
      })
    }
    return out
  } finally {
    await browser.close()
  }
}
