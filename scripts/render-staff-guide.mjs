// Renders the clinic staff "Filming Content" quick guide to a branded
// 2-page A4 PDF using local puppeteer + an embedded QR to the Studio portal.
//
//   node scripts/render-staff-guide.mjs
//
// Output: samples/staff-filming-guide.pdf
//
// Override the QR target (per-clinic install link is ideal — it sets the
// clinic cookie, then lands on /studio):
//   STAFF_PORTAL_URL="https://app.example.com/c/<token>" node scripts/render-staff-guide.mjs
//
// HWC brand: Playfair Display + Inter, ocean / teal / coral / sand.

import { writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
import QRCode from 'qrcode'

// Local Chrome — puppeteer's bundled-browser path pulls a transitive dep
// (proxy-agent) that isn't installed here, so drive a system Chrome via
// puppeteer-core instead. Override with CHROME_PATH if needed.
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
].filter(Boolean)
const CHROME = CHROME_CANDIDATES.find((p) => existsSync(p))

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const PORTAL_URL =
  process.env.STAFF_PORTAL_URL ?? 'https://your-content-machine.app/studio'

const BRAND = {
  ocean: '#0E4D64',
  teal: '#2A9D8F',
  coral: '#E76F51',
  sand: '#F7EFE2',
  sandDeep: '#EFE2CC',
  ink: '#16323B',
}

function step(num, color, title, body) {
  return `
  <div class="step">
    <div class="step-num" style="background:${color}">${num}</div>
    <div class="step-body">
      <h3>${title}</h3>
      ${body}
    </div>
  </div>`
}

function buildHTML(qrDataUrl) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { font-family:'Inter',sans-serif; color:${BRAND.ink}; }
  .page {
    width:210mm; height:297mm; padding:18mm 16mm; position:relative;
    background:${BRAND.sand}; overflow:hidden; page-break-after:always;
  }
  .page:last-child { page-break-after:auto; }
  .eyebrow { font-size:10pt; letter-spacing:.22em; text-transform:uppercase;
    color:${BRAND.teal}; font-weight:700; }
  h1 { font-family:'Playfair Display',serif; font-size:34pt; line-height:1.05;
    color:${BRAND.ocean}; font-weight:800; margin-top:6pt; }
  h1 .accent { color:${BRAND.coral}; }
  .lede { font-size:12pt; color:${BRAND.ink}; margin-top:10pt; max-width:150mm;
    line-height:1.5; }
  .rule { height:3px; width:54mm; background:${BRAND.coral}; border-radius:3px;
    margin:16pt 0 20pt; }
  .step { display:flex; gap:14pt; margin-bottom:18pt; align-items:flex-start; }
  .step-num { flex:0 0 auto; width:34pt; height:34pt; border-radius:50%;
    color:#fff; font-family:'Playfair Display',serif; font-weight:700;
    font-size:17pt; display:flex; align-items:center; justify-content:center; }
  .step-body h3 { font-family:'Playfair Display',serif; font-size:16pt;
    color:${BRAND.ocean}; margin-bottom:5pt; }
  .step-body p { font-size:11pt; line-height:1.5; }
  ul { list-style:none; margin-top:5pt; }
  li { font-size:11pt; line-height:1.6; padding-left:16pt; position:relative; }
  li::before { content:'›'; position:absolute; left:0; color:${BRAND.teal};
    font-weight:700; }
  .pill { display:inline-block; background:${BRAND.sandDeep}; color:${BRAND.ocean};
    border-radius:999px; padding:2pt 9pt; font-size:9.5pt; font-weight:600;
    margin:0 3pt 3pt 0; }
  .card { background:#fff; border-radius:14pt; padding:16pt 18pt;
    box-shadow:0 2pt 10pt rgba(14,77,100,.08); }
  .footer { position:absolute; left:16mm; right:16mm; bottom:14mm;
    font-size:8.5pt; color:${BRAND.teal}; display:flex; justify-content:space-between;
    border-top:1px solid ${BRAND.sandDeep}; padding-top:8pt; }
  .checklist li { font-size:11.5pt; line-height:2; padding-left:22pt; }
  .checklist li::before { content:'◻'; color:${BRAND.coral}; font-size:13pt;
    top:-1pt; }
  .qr-wrap { display:flex; gap:18pt; align-items:center; }
  .qr-wrap img { width:42mm; height:42mm; border:6px solid #fff; border-radius:10pt;
    box-shadow:0 2pt 10pt rgba(14,77,100,.12); }
  .qr-text h3 { font-family:'Playfair Display',serif; color:${BRAND.ocean};
    font-size:18pt; margin-bottom:6pt; }
  .qr-text p { font-size:11pt; line-height:1.5; }
  .url { font-family:monospace; font-size:9pt; color:${BRAND.teal};
    word-break:break-all; margin-top:6pt; }
  .blob { position:absolute; border-radius:50%; opacity:.5; filter:blur(2px); }
</style></head>
<body>

  <!-- PAGE 1 -->
  <section class="page">
    <div class="blob" style="width:120mm;height:120mm;background:${BRAND.sandDeep};
      right:-50mm;top:-40mm;"></div>
    <div style="position:relative;">
      <div class="eyebrow">Hawaii Wellness Clinic · Content Team</div>
      <h1>Filming content at the clinic<br><span class="accent">made simple</span></h1>
      <p class="lede">You don't need to be a videographer. Follow three steps —
        film it, upload it, and let the portal hand you the idea and the lines.
        This page is everything you need.</p>
      <div class="rule"></div>

      ${step(
        '1',
        BRAND.teal,
        'How to film',
        `<ul>
          <li><b>Hold the phone vertical</b> (9:16) — fills the whole screen on Reels &amp; TikTok.</li>
          <li><b>Face a window or light</b>, never with a bright window behind you.</li>
          <li><b>Get close for sound</b> — quiet room, no echo. Audio matters more than camera.</li>
          <li><b>Wipe the lens</b>, keep the phone steady (lean on something or use a tripod).</li>
          <li><b>Do 2–3 takes</b> and keep it short — 20–45 seconds is plenty.</li>
        </ul>`
      )}

      ${step(
        '2',
        BRAND.coral,
        'Where to upload',
        `<p>Everything goes to <b>one place</b> — the shared <b>Google Drive “Inbox”</b> folder.
        The editing team picks it up from there. Don't email clips or use a personal drive.</p>
        <div style="margin-top:8pt;">
          <span class="pill">Name it clearly: YourName_Topic_Date</span>
          <span class="pill">e.g. Maria_KneePain_Jun08</span>
        </div>`
      )}
    </div>
    <div class="footer"><span>HWC Content Machine · Studio guide</span><span>Page 1 / 2</span></div>
  </section>

  <!-- PAGE 2 -->
  <section class="page">
    <div class="blob" style="width:110mm;height:110mm;background:${BRAND.sandDeep};
      left:-46mm;bottom:-44mm;"></div>
    <div style="position:relative;">
      <div class="eyebrow">Where the ideas come from</div>
      <h1 style="font-size:28pt;">Open Studio. <span class="accent">Pick a format. Film.</span></h1>
      <div class="rule"></div>

      ${step(
        '3',
        BRAND.ocean,
        'Get your idea from the portal',
        `<ul>
          <li><b>Scan the code below</b> to open <b>Studio</b> on your phone.</li>
          <li><b>Swipe the cards sideways</b> — each is a format that's working right now, with a real example video. <b>Watch it.</b></li>
          <li>Under it you get the <b>idea + the script</b>, broken down by who says what (<span style="color:${BRAND.teal}">Doctor</span>, <span style="color:${BRAND.coral}">Patient</span>, Assistant, Narrator).</li>
          <li>Don't love the idea? Tap <b>“Regenerate idea”</b>. Want a different video? Tap <b>“Change video”.</b></li>
          <li>Film it the same way the example does — then upload to the Drive Inbox.</li>
        </ul>`
      )}

      <div class="card" style="margin:14pt 0 20pt;">
        <p class="eyebrow" style="margin-bottom:10pt;">Before you send — quick check</p>
        <ul class="checklist">
          <li>Vertical, well-lit, clear audio</li>
          <li>Followed the example's structure (hook → point → call to action)</li>
          <li>Said the lines for each role</li>
          <li>Named the file and dropped it in the Drive Inbox</li>
        </ul>
      </div>

      <div class="qr-wrap">
        <img src="${qrDataUrl}" alt="Studio QR" />
        <div class="qr-text">
          <h3>📲 Open Studio</h3>
          <p>Point your camera at the code. Bookmark it — new ideas appear every week.</p>
          <p class="url">${PORTAL_URL}</p>
        </div>
      </div>
    </div>
    <div class="footer"><span>Questions? Ask the marketing team.</span><span>Page 2 / 2</span></div>
  </section>

</body></html>`
}

async function main() {
  const qrDataUrl = await QRCode.toDataURL(PORTAL_URL, {
    margin: 1,
    width: 600,
    color: { dark: BRAND.ocean, light: '#ffffff' },
  })
  const html = buildHTML(qrDataUrl)

  await mkdir(join(root, 'samples'), { recursive: true })
  // Keep the HTML too, for quick eyeballing / re-styling.
  await writeFile(join(root, 'samples', 'staff-filming-guide.html'), html)

  if (!CHROME) {
    throw new Error(
      'No Chrome found. Set CHROME_PATH to a Chrome/Chromium executable.'
    )
  }
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'networkidle0' })
  const outPath = join(root, 'samples', 'staff-filming-guide.pdf')
  await page.pdf({
    path: outPath,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
  })
  await browser.close()
  console.log(`✓ wrote ${outPath}`)
  console.log(`  QR → ${PORTAL_URL}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
