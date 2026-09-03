// One-page A4 card that hands someone the shared floor-media folder:
// the link, a QR for phones, and one paragraph saying what's inside.
// Same visual system as scripts/render-staff-guide.mjs (HWC white +
// blue aura, Playfair + Inter) so the two read as one set.
//
//   FOLDER_URL="https://drive.google.com/drive/folders/<id>" node scripts/render-folder-card.mjs
//
// Output: samples/floor-folder-access.pdf

import { readFileSync, existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
import QRCode from 'qrcode'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// The folder link is a capability URL — anyone holding it reads the clinic's
// material — and this repository is public, so it is never hardcoded here.
// Pass it in; the live value sits in clinics.drive_floor_folder_id.
const FOLDER_URL = process.env.FOLDER_URL
if (!FOLDER_URL) {
  console.error(
    'FOLDER_URL is required, e.g.\n' +
      '  FOLDER_URL="https://drive.google.com/drive/folders/<id>" node scripts/render-folder-card.mjs'
  )
  process.exit(1)
}

// The landing-page set is the canonical HWC mark; the folders differ by
// vertical but carry the same logo file.
const LOGO_CANDIDATES = [
  '/Users/igorlinnik/Documents/Code Projects/Hawaii Wellness Clinic/clinic-landings/HWC-Landing-pages/wellness/logo.png',
  '/Users/igorlinnik/Documents/Code Projects/Hawaii Wellness Clinic/clinic-landings/HWC-Landing-pages/aesthetics/logo.png',
  '/Users/igorlinnik/Documents/Code Projects/Hawaii Wellness Clinic/clinic-landings/HWC-Landing-pages/weight-loss/logo.png',
  '/Users/igorlinnik/Documents/Code Projects/Hawaii Wellness Clinic/HWC-Landing-pages/Wellness Landing 2/logo.png',
]
const LOGO_PATH = LOGO_CANDIDATES.find((p) => existsSync(p))
const LOGO_DATA = LOGO_PATH
  ? `data:image/png;base64,${readFileSync(LOGO_PATH).toString('base64')}`
  : null

const C = {
  navy: '#1E3A5F',
  ink: '#2B3A4A',
  blue: '#2F6BFF',
  sky: '#6BA8FF',
  mist: '#EAF2FF',
  line: '#E6EEF8',
}

const CHROME = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
].filter(Boolean).find((p) => existsSync(p))

const today = new Date().toLocaleDateString('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'Pacific/Honolulu',
})

// STYLE=mono — a plain black-and-white sheet: logo, rule, text, link,
// QR. No cards, no gradients; prints cleanly on any office printer.
function buildMonoHTML(qrDataUrl) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  html,body { font-family:'Inter',sans-serif; color:#111; }
  .page { width:210mm; height:297mm; padding:26mm 22mm; background:#fff; position:relative; }
  .logo { height:15mm; margin-bottom:16pt; filter:grayscale(1) contrast(1.15); }
  .eyebrow { font-size:9pt; letter-spacing:.24em; text-transform:uppercase; color:#666; font-weight:600; }
  h1 { font-family:'Playfair Display',serif; font-size:32pt; line-height:1.08; margin-top:8pt; font-weight:700; }
  .lede { font-size:12pt; line-height:1.65; margin-top:14pt; max-width:150mm; color:#222; }
  hr { border:0; border-top:1px solid #111; margin:20pt 0; }
  h2 { font-family:'Playfair Display',serif; font-size:16pt; margin-bottom:9pt; }
  .link-row { display:flex; gap:16pt; align-items:flex-start; }
  .link-row img.qr { width:34mm; height:34mm; flex:0 0 auto; }
  a.url { display:block; font-family:monospace; font-size:11pt; line-height:1.6; color:#111;
    word-break:break-all; text-decoration:underline; }
  .hint { font-size:10.5pt; line-height:1.6; color:#333; margin-top:9pt; }
  ul { list-style:none; margin-top:4pt; }
  li { font-size:11.5pt; line-height:1.8; padding-left:14pt; position:relative; color:#222; }
  li::before { content:'—'; position:absolute; left:0; color:#111; }
  b { font-weight:600; }
  .section { margin-top:22pt; }
  .footer { position:absolute; left:22mm; right:22mm; bottom:16mm; font-size:8.5pt; color:#777;
    display:flex; justify-content:space-between; border-top:1px solid #ddd; padding-top:8pt; }
</style></head>
<body>
  <div class="page">
    ${LOGO_DATA ? `<img class="logo" src="${LOGO_DATA}" alt="Hawaii Wellness Clinic" />` : ''}
    <div class="eyebrow">Shared Drive folder</div>
    <h1>Photos and Videos from the Floor</h1>
    <p class="lede">
      Everything our medical assistants film during their shifts — short clips and photos of
      the team at work, the rooms and the equipment. New files land here as they are submitted,
      so the folder keeps filling up on its own.
    </p>
    <hr/>
    <div class="section">
      <h2>Open the folder</h2>
      <div class="link-row">
        <img class="qr" src="${qrDataUrl}" alt="QR to the folder" />
        <div>
          <a class="url" href="${FOLDER_URL}">${FOLDER_URL}</a>
          <p class="hint">Tap the link or scan the code with a phone camera. No sign-in and no
          request needed — the link opens the folder for anyone who has it.</p>
        </div>
      </div>
    </div>
    <div class="section">
      <h2>What&rsquo;s inside</h2>
      <ul>
        <li><b>Video clips</b> — ten-second clips, no sound, shot vertically or flat.</li>
        <li><b>Photos</b> — stills from the same shifts.</li>
        <li>File names carry who uploaded them, so credit is easy to trace.</li>
        <li>Download whatever you need; please don&rsquo;t rename or delete anything — this is the
            working folder the team uploads into.</li>
      </ul>
    </div>
    <div class="footer">
      <span>Honolulu &middot; Hilo &middot; Kona</span>
      <span>${today}</span>
      <span>Marketing &amp; Content</span>
    </div>
  </div>
</body></html>`
}

function buildHTML(qrDataUrl) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  html,body { font-family:'Inter',sans-serif; color:${C.ink}; }
  .page { position:relative; width:210mm; height:297mm; padding:24mm 19mm; background:#fff; overflow:hidden; }
  .blob { position:absolute; border-radius:50%; filter:blur(60px); opacity:.55; }
  .b1 { width:150mm; height:150mm; background:${C.sky}; right:-55mm; top:-60mm; }
  .b2 { width:120mm; height:120mm; background:${C.mist}; left:-50mm; bottom:-45mm; opacity:.9; }
  .b3 { width:90mm; height:90mm; background:${C.blue}; right:-30mm; bottom:-30mm; opacity:.18; }
  .wrap { position:relative; z-index:1; }
  .logo { height:15mm; margin-bottom:12pt; }
  .eyebrow { font-size:9.5pt; letter-spacing:.24em; text-transform:uppercase; color:${C.blue}; font-weight:700; }
  h1 { font-family:'Playfair Display',serif; font-size:35pt; line-height:1.05; color:${C.navy}; font-weight:700; margin-top:8pt; }
  .lede { font-size:12pt; margin-top:12pt; max-width:158mm; line-height:1.6; }
  .rule { height:3px; width:52mm; background:linear-gradient(90deg,${C.blue},${C.sky}); border-radius:3px; margin:18pt 0 22pt; }
  .card { background:rgba(255,255,255,.78); border:1px solid ${C.line}; border-radius:16pt;
    padding:19pt 22pt; box-shadow:0 8pt 30pt rgba(47,107,255,.08); }
  .card + .card { margin-top:17pt; }
  .card h3 { font-family:'Playfair Display',serif; font-size:18pt; color:${C.navy}; margin-bottom:10pt; }
  .link-row { display:flex; gap:20pt; align-items:center; }
  .link-row img.qr { width:41mm; height:41mm; flex:0 0 auto; border:6px solid #fff; border-radius:10pt;
    box-shadow:0 8pt 26pt rgba(47,107,255,.16); }
  .url { display:block; font-family:monospace; font-size:10.5pt; line-height:1.55; color:${C.blue};
    word-break:break-all; text-decoration:none; background:${C.mist}; border:1px solid ${C.line};
    border-radius:10pt; padding:11pt 13pt; }
  .hint { font-size:10.5pt; color:${C.ink}; margin-top:10pt; line-height:1.55; }
  ul { list-style:none; margin-top:4pt; }
  li { font-size:11.5pt; line-height:1.75; padding-left:17pt; position:relative; }
  li::before { content:''; position:absolute; left:0; top:8pt; width:6pt; height:6pt; border-radius:50%; background:${C.sky}; }
  b { color:${C.navy}; }
  .footer { position:absolute; z-index:1; left:18mm; right:18mm; bottom:14mm; font-size:8.5pt;
    color:${C.sky}; display:flex; justify-content:space-between; border-top:1px solid ${C.line}; padding-top:8pt; }
</style></head>
<body>
  <div class="page">
    <div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div>
    <div class="wrap">
      ${LOGO_DATA ? `<img class="logo" src="${LOGO_DATA}" alt="Hawaii Wellness Clinic" />` : ''}
      <div class="eyebrow">Shared Drive folder</div>
      <h1>Photos and Videos<br/>from the Floor</h1>
      <p class="lede">
        Everything our medical assistants film during their shifts — short clips and photos
        of the team at work, the rooms and the equipment. New files land here as they are
        submitted, so the folder keeps filling up on its own.
      </p>
      <div class="rule"></div>

      <div class="card">
        <h3>Open the folder</h3>
        <div class="link-row">
          <img class="qr" src="${qrDataUrl}" alt="QR to the folder" />
          <div style="flex:1 1 auto;">
            <a class="url" href="${FOLDER_URL}">${FOLDER_URL}</a>
            <p class="hint">
              Tap the link or scan the code with a phone camera. No sign-in and no request
              needed — the link opens the folder for anyone who has it.
            </p>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>What&rsquo;s inside</h3>
        <ul>
          <li><b>Video clips</b> — ten-second clips, no sound, shot vertically or flat.</li>
          <li><b>Photos</b> — stills from the same shifts.</li>
          <li>File names carry who uploaded them, so credit is easy to trace.</li>
          <li>Download whatever you need; please don&rsquo;t rename or delete anything —
              this is the working folder the team uploads into.</li>
        </ul>
      </div>
    </div>
    <div class="footer">
      <span>Honolulu &middot; Hilo &middot; Kona</span>
      <span>${today}</span>
      <span>Marketing &amp; Content</span>
    </div>
  </div>
</body></html>`
}

async function main() {
  const mono = process.env.STYLE === 'mono'
  const qrDataUrl = await QRCode.toDataURL(FOLDER_URL, {
    margin: 1,
    width: 600,
    color: { dark: mono ? '#111111' : C.navy, light: '#ffffff' },
  })
  const html = mono ? buildMonoHTML(qrDataUrl) : buildHTML(qrDataUrl)
  await mkdir(join(root, 'samples'), { recursive: true })

  if (!CHROME) throw new Error('No Chrome found. Set CHROME_PATH.')
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const base = mono ? 'floor-folder-access-bw' : 'floor-folder-access'
    const outPath = join(root, 'samples', `${base}.pdf`)
    await page.pdf({ path: outPath, format: 'A4', printBackground: true, preferCSSPageSize: true })
    // A PNG next to it, so the layout can be eyeballed without a PDF viewer.
    await page.setViewport({ width: 992, height: 1403, deviceScaleFactor: 2 })
    await page.screenshot({ path: join(root, 'samples', `${base}.png`) })
    console.log(`✓ wrote ${outPath}`)
    console.log(`  logo: ${LOGO_PATH ? 'embedded' : 'MISSING'}`)
  } finally {
    await browser.close()
  }
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
