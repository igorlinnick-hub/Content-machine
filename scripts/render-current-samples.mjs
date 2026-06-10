// Renders 3 sample slides (cover / body / cta) using the CURRENT
// lib/visual/templates.ts via local puppeteer. Output goes to
// samples/current-{cover,body,cta}.png so we can eyeball vs Canva targets.
//
// Sample input mimics the TMS-style HWC post the doctor would actually send.

import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// Inline the buildSlideHTML logic from lib/visual/templates.ts to avoid TS
// transpile setup. Keep this 1:1 with templates.ts; if templates.ts changes,
// update here. (Acceptable for a one-shot debug script.)

const BRAND = {
  primary: '#1e3a8a',
  accent: '#3b82f6',
  surface: '#ffffff',
  surface_text: '#1e3a8a',
  card_text: '#ffffff',
}
const CANVAS = { width: 1080, height: 1350 }
const PADDING = 64
const FONT = 'Inter'

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function buildCover({ chip, headline, subhead }) {
  return `<!doctype html><html><head><meta charset=utf-8><style>
*{box-sizing:border-box;margin:0;padding:0}html,body{width:${CANVAS.width}px;height:${CANVAS.height}px}
body{position:relative;width:${CANVAS.width}px;height:${CANVAS.height}px;font-family:${FONT},-apple-system,Arial,sans-serif;background:${BRAND.surface};color:${BRAND.surface_text};overflow:hidden}
.glow{position:absolute;top:-25%;right:-20%;width:80%;height:80%;background:radial-gradient(closest-side,${BRAND.accent}55,transparent 70%)}
.glow-bottom{position:absolute;bottom:-25%;left:-25%;width:70%;height:70%;background:radial-gradient(closest-side,${BRAND.accent}33,transparent 70%)}
.frame{position:absolute;inset:0;padding:${PADDING}px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.eyebrow{font-size:28px;font-weight:700;letter-spacing:.32em;text-transform:uppercase;margin-bottom:56px}
.headline{font-size:96px;font-weight:800;line-height:1.05;text-transform:uppercase;letter-spacing:-.01em}
.subhead{margin-top:64px;font-size:22px;font-weight:600;line-height:1.45;text-transform:uppercase;letter-spacing:.12em;max-width:60%;opacity:.85}
</style></head><body>
<div class=glow></div><div class=glow-bottom></div>
<div class=frame>
  ${chip ? `<div class=eyebrow>${esc(chip)}</div>` : ''}
  <div class=headline>${esc(headline)}</div>
  ${subhead ? `<div class=subhead>${esc(subhead)}</div>` : ''}
</div></body></html>`
}

function buildBody({ chip, chipQuote, body, photoUrl }) {
  const bg = photoUrl
    ? `background:url('${photoUrl}') center/cover no-repeat ${BRAND.primary};`
    : `background:${BRAND.primary};`
  return `<!doctype html><html><head><meta charset=utf-8><style>
*{box-sizing:border-box;margin:0;padding:0}html,body{width:${CANVAS.width}px;height:${CANVAS.height}px}
body{position:relative;width:${CANVAS.width}px;height:${CANVAS.height}px;font-family:${FONT},-apple-system,Arial,sans-serif;color:${BRAND.card_text};overflow:hidden;${bg}}
.top-card{position:absolute;top:${PADDING}px;left:${PADDING}px;right:${PADDING}px;background:${BRAND.primary};border-radius:20px;padding:32px 40px;box-shadow:0 8px 32px rgba(0,0,0,.18)}
.chip{font-size:22px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;margin-bottom:12px;opacity:.9}
.chip-quote{font-size:30px;font-weight:700;line-height:1.25;font-style:italic}
.body-card{position:absolute;bottom:${PADDING}px;left:${PADDING}px;right:${PADDING}px;background:${BRAND.primary};border-radius:20px;padding:40px 44px;box-shadow:0 8px 32px rgba(0,0,0,.18)}
.body{font-size:24px;font-weight:700;line-height:1.45;letter-spacing:.06em;text-transform:uppercase;text-align:center}
</style></head><body>
${chip || chipQuote ? `<div class=top-card>
  ${chip ? `<div class=chip>${esc(chip)}</div>` : ''}
  ${chipQuote ? `<div class=chip-quote>${esc(chipQuote)}</div>` : ''}
</div>` : ''}
<div class=body-card><div class=body>${esc(body)}</div></div>
</body></html>`
}

function buildCta({ headline, middle, action, photoUrl }) {
  const bg = photoUrl
    ? `background:url('${photoUrl}') center/cover no-repeat ${BRAND.primary};`
    : `background:${BRAND.primary};`
  return `<!doctype html><html><head><meta charset=utf-8><style>
*{box-sizing:border-box;margin:0;padding:0}html,body{width:${CANVAS.width}px;height:${CANVAS.height}px}
body{position:relative;width:${CANVAS.width}px;height:${CANVAS.height}px;font-family:${FONT},-apple-system,Arial,sans-serif;color:${BRAND.card_text};overflow:hidden;${bg}}
.card{position:absolute;bottom:${PADDING}px;left:${PADDING}px;right:${PADDING}px;background:${BRAND.primary};border-radius:20px;padding:56px 48px 64px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.22)}
.h{font-size:38px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;line-height:1.2;margin-bottom:24px}
.m{font-size:22px;font-weight:600;line-height:1.45;letter-spacing:.08em;text-transform:uppercase;opacity:.85;margin-bottom:28px}
.a{font-size:26px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;line-height:1.3}
</style></head><body>
<div class=card>
  ${headline ? `<div class=h>${esc(headline)}</div>` : ''}
  ${middle ? `<div class=m>${esc(middle)}</div>` : ''}
  <div class=a>${esc(action)}</div>
</div></body></html>`
}

// Realistic TMS sample (matches Canva style 1 input)
const SAMPLES = [
  {
    name: 'current-cover',
    html: buildCover({
      chip: 'TMS THERAPY',
      headline: 'HOW MAGNETIC\nFIELDS CHANGE\nDEPRESSION',
      subhead: 'A non-invasive, FDA-cleared treatment',
    }),
  },
  {
    name: 'current-body',
    html: buildBody({
      chip: 'WHAT TMS IS',
      chipQuote: '',
      body: 'TMS (TRANSCRANIAL MAGNETIC STIMULATION) IS A NON-INVASIVE PROCEDURE. A MAGNETIC COIL PLACED NEAR THE SCALP DELIVERS FOCUSED ELECTROMAGNETIC PULSES TO SPECIFIC REGIONS OF THE BRAIN.',
      photoUrl: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=1080&q=80',
    }),
  },
  {
    name: 'current-cta',
    html: buildCta({
      headline: 'STILL HAVE QUESTIONS?',
      middle: 'OUR TEAM HAS HELPED 1,200+ PATIENTS',
      action: 'BOOK A CONSULTATION — LINK IN BIO',
      photoUrl: 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=1080&q=80',
    }),
  },
]

const samplesDir = join(root, 'samples')
await mkdir(samplesDir, { recursive: true })

const puppeteer = (await import('puppeteer')).default
const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  headless: true,
})

try {
  for (const s of SAMPLES) {
    const page = await browser.newPage()
    await page.setViewport({
      width: CANVAS.width,
      height: CANVAS.height,
      deviceScaleFactor: 1,
    })
    await page.setContent(s.html, { waitUntil: 'networkidle0' })
    const shot = await page.screenshot({ type: 'png' })
    const out = join(samplesDir, `${s.name}.png`)
    await writeFile(out, shot)
    console.log(`[render] wrote ${out}`)
    await page.close()
  }
} finally {
  await browser.close()
}
