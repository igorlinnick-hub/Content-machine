// Smoke test: launches a headless chromium, screenshots a tiny HTML
// page, writes a PNG. Useful to confirm the renderer pipeline works
// without spinning up Next.
//
// Usage:
//   node scripts/smoke-render.mjs           # uses local puppeteer (dev)
//   node scripts/smoke-render.mjs --vercel  # uses puppeteer-core + @sparticuz/chromium

import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const start = Date.now()
const forceServerless = process.argv.includes('--vercel')
console.log(`[smoke] mode=${forceServerless ? 'serverless' : 'local'}`)

let browser
if (forceServerless) {
  const chromium = (await import('@sparticuz/chromium')).default
  const puppeteer = await import('puppeteer-core')
  browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  })
} else {
  const puppeteer = await import('puppeteer')
  browser = await puppeteer.default.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true,
  })
}

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 })
  const dir = await mkdtemp(join(tmpdir(), 'cm-smoke-'))
  for (let i = 1; i <= 3; i += 1) {
    const html = `<!doctype html><meta charset=utf-8><body style="margin:0;display:flex;align-items:center;justify-content:center;width:1080px;height:1080px;font:600 64px Inter,Arial,sans-serif">Slide ${i}</body>`
    await page.setContent(html, { waitUntil: 'load' })
    const shot = await page.screenshot({ type: 'png' })
    await writeFile(join(dir, `slide-${i}.png`), shot)
  }
  console.log(`[smoke] OK — wrote 3 PNGs to ${dir} in ${Date.now() - start}ms`)
} finally {
  await browser.close()
}
