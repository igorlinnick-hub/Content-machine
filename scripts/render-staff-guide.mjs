// Renders the clinic staff "Filming Content" quick guide to a clean,
// white, blue-gradient 2-page A4 PDF (HWC logo, soft blue aura blobs —
// matching the clinic's testimonial visual style).
//
//   node scripts/render-staff-guide.mjs
//
// Output: samples/staff-filming-guide.pdf
// Override the Studio QR target:
//   STAFF_PORTAL_URL="https://app.example.com/studio?tab=shotlist" node scripts/render-staff-guide.mjs

import { readFileSync, mkdir as _mkdir } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
import QRCode from 'qrcode'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const PORTAL_URL =
  process.env.STAFF_PORTAL_URL ??
  'https://content-machine-gules.vercel.app/studio?tab=shotlist'

// Where finished clips go (the clinic's shared Drive folder).
const DRIVE_URL =
  process.env.DRIVE_UPLOAD_URL ??
  'https://drive.google.com/drive/folders/1erhf5AURtETtyXUlnskCNiSVUvD_JfKJ?usp=share_link'

// Login — the app's base URL + the access codes.
const LOGIN_URL = process.env.LOGIN_URL ?? 'https://content-machine-gules.vercel.app'
const TEAM_CODE = process.env.TEAM_CODE ?? 'hwc-team'
const DOCTOR_CODE = process.env.DOCTOR_CODE ?? 'hwc-doctor'

// HWC wave logo → embed as base64 so the PDF is self-contained.
const LOGO_CANDIDATES = [
  '/Users/igorlinnik/Documents/Code Projects/Hawaii Wellness Clinic/clinic-landings/HWC-Landing-pages/wellness/logo.png',
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

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
].filter(Boolean)
const CHROME = CHROME_CANDIDATES.find((p) => existsSync(p))

function step(num, title, body) {
  return `
  <div class="step">
    <div class="step-num">${num}</div>
    <div class="step-body"><h3>${title}</h3>${body}</div>
  </div>`
}

function buildHTML(qrDataUrl) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  html,body { font-family:'Inter',sans-serif; color:${C.ink}; }
  .page {
    position:relative; width:210mm; height:297mm; padding:20mm 18mm;
    background:#ffffff; overflow:hidden; page-break-after:always;
  }
  .page:last-child { page-break-after:auto; }
  /* soft blue aura blobs */
  .blob { position:absolute; border-radius:50%; filter:blur(60px); opacity:.55; }
  .b1 { width:150mm; height:150mm; background:${C.sky};   right:-55mm; top:-60mm; }
  .b2 { width:120mm; height:120mm; background:${C.mist};  left:-50mm;  bottom:-45mm; opacity:.9; }
  .b3 { width:90mm;  height:90mm;  background:${C.blue};  right:-30mm; bottom:-30mm; opacity:.18; }
  .wrap { position:relative; z-index:1; }

  .logo { height:15mm; margin-bottom:10pt; }
  .eyebrow { font-size:9.5pt; letter-spacing:.24em; text-transform:uppercase;
    color:${C.blue}; font-weight:700; }
  h1 { font-family:'Playfair Display',serif; font-size:33pt; line-height:1.05;
    color:${C.navy}; font-weight:700; margin-top:7pt; }
  h1 .accent { color:${C.blue}; }
  .lede { font-size:12pt; color:${C.ink}; margin-top:11pt; max-width:150mm; line-height:1.55; }
  .rule { height:3px; width:52mm; background:linear-gradient(90deg,${C.blue},${C.sky});
    border-radius:3px; margin:16pt 0 22pt; }

  .step { display:flex; gap:14pt; margin-bottom:18pt; align-items:flex-start; }
  .step-num { flex:0 0 auto; width:30pt; height:30pt; border-radius:50%;
    background:linear-gradient(135deg,${C.blue},${C.sky}); color:#fff;
    font-family:'Playfair Display',serif; font-weight:700; font-size:15pt;
    display:flex; align-items:center; justify-content:center; }
  .step-body h3 { font-family:'Playfair Display',serif; font-size:16pt;
    color:${C.navy}; margin-bottom:5pt; }
  ul { list-style:none; margin-top:5pt; }
  li { font-size:11pt; line-height:1.6; padding-left:16pt; position:relative; }
  li::before { content:''; position:absolute; left:0; top:7pt; width:6pt; height:6pt;
    border-radius:50%; background:${C.sky}; }
  b { color:${C.navy}; }
  .pill { display:inline-block; background:${C.mist}; color:${C.navy};
    border-radius:999px; padding:3pt 10pt; font-size:9.5pt; font-weight:600; margin:0 4pt 4pt 0; }
  .codes { display:flex; gap:10pt; margin-top:10pt; }
  .code { flex:1; background:${C.mist}; border:1px solid ${C.line}; border-radius:10pt; padding:9pt 12pt; }
  .code .who { font-size:8.5pt; letter-spacing:.1em; text-transform:uppercase; color:${C.blue}; font-weight:700; }
  .code .val { font-family:monospace; font-size:15pt; font-weight:700; color:${C.navy}; margin-top:2pt; }
  .card { background:rgba(255,255,255,.75); border:1px solid ${C.line};
    border-radius:16pt; padding:16pt 18pt; box-shadow:0 8pt 30pt rgba(47,107,255,.08);
    backdrop-filter:blur(2px); }
  .checklist li { font-size:11.5pt; line-height:2; padding-left:22pt; }
  .checklist li::before { content:'○'; background:none; color:${C.blue};
    width:auto; height:auto; top:0; font-size:12pt; }
  .footer { position:absolute; z-index:1; left:18mm; right:18mm; bottom:14mm;
    font-size:8.5pt; color:${C.sky}; display:flex; justify-content:space-between;
    border-top:1px solid ${C.line}; padding-top:8pt; }
  .qr-wrap { display:flex; gap:18pt; align-items:center; }
  .qr-wrap img.qr { width:42mm; height:42mm; border:8px solid #fff; border-radius:12pt;
    box-shadow:0 8pt 26pt rgba(47,107,255,.16); }
  .qr-text h3 { font-family:'Playfair Display',serif; color:${C.navy}; font-size:18pt; margin-bottom:6pt; }
  .qr-text p { font-size:11pt; line-height:1.5; }
  .link { font-family:monospace; font-size:8.5pt; color:${C.blue}; word-break:break-all; margin-top:6pt; }
  .cta { display:inline-block; margin-top:12pt; background:linear-gradient(135deg,${C.blue},${C.sky});
    color:#fff; font-weight:600; font-size:11pt; padding:9pt 18pt; border-radius:10pt; text-decoration:none; }
</style></head>
<body>

  <!-- PAGE 1 -->
  <section class="page">
    <div class="blob b1"></div><div class="blob b2"></div>
    <div class="wrap">
      ${LOGO_DATA ? `<img class="logo" src="${LOGO_DATA}" alt="HWC"/>` : ''}
      <div class="eyebrow">Content Team · Quick Guide</div>
      <h1>Filming content at the clinic<br><span class="accent">made simple</span></h1>
      <p class="lede">You don't need to be a videographer. Film it, upload it,
        and the app hands you the idea and the lines. This page is everything you need.</p>
      <div class="rule"></div>

      ${step(
        '1',
        'How to film',
        `<ul>
          <li><b>Hold the phone vertical</b> (9:16) — fills the screen on Reels &amp; TikTok.</li>
          <li><b>Face a window or light</b>, never with a bright window behind you.</li>
          <li><b>Get close for sound</b> — quiet room, no echo. Audio matters more than the camera.</li>
          <li><b>Wipe the lens</b>, keep the phone steady (lean it on something or use a tripod).</li>
          <li><b>Do 2–3 takes</b> and keep it short — 20–45 seconds is plenty.</li>
        </ul>`
      )}

      ${step(
        '2',
        'Where to upload',
        `<p style="font-size:11pt;line-height:1.6;">Everything goes to <b>one place</b> —
        the clinic's shared <b>Google Drive folder</b>. The team picks it up from there.
        Don't email clips or use a personal drive.</p>
        <div style="margin-top:8pt;">
          <span class="pill">Name it: YourName_Topic_Date</span>
          <span class="pill">e.g. Maria_KneePain_Jun08</span>
        </div>
        <a class="cta" href="${DRIVE_URL}">Open the upload folder →</a>`
      )}
    </div>
    <div class="footer"><span>Hawaii Wellness Clinic · Studio guide</span><span>1 / 2</span></div>
  </section>

  <!-- PAGE 2 -->
  <section class="page">
    <div class="blob b1" style="left:-55mm;right:auto;top:-55mm;"></div>
    <div class="blob b3"></div>
    <div class="wrap">
      ${LOGO_DATA ? `<img class="logo" src="${LOGO_DATA}" alt="HWC"/>` : ''}
      <div class="eyebrow">Where the ideas come from</div>
      <h1 style="font-size:27pt;">Open Studio. <span class="accent">Go to Shot List. Film.</span></h1>
      <div class="rule"></div>

      ${step(
        '3',
        'Get today’s ideas — the Shot List',
        `<ul>
          <li><b>Log in first</b> (see the box below), then open <b>Studio</b>.</li>
          <li>Open the <b>“Shot List”</b> tab — that’s <b>your list of what to film</b>. New ideas are added for you.</li>
          <li>Each card has the <b>example video</b> (watch it) + a <b>simple script</b>: who says what — <b>Doctor</b> on camera and <b>Operator</b> behind it — plus the steps.</li>
          <li>You can browse the other videos too, but <b>Shot List is where to start.</b></li>
          <li>Film it the same way, <b>inside the clinic</b> — then upload to the Drive folder.</li>
        </ul>`
      )}

      <div class="card" style="margin:12pt 0 20pt;">
        <p class="eyebrow" style="margin-bottom:10pt;">Before you send — quick check</p>
        <ul class="checklist">
          <li>Vertical, well-lit, clear audio</li>
          <li>Followed the example's structure (hook → point → call to action)</li>
          <li>Said the lines for each role</li>
          <li>Named the file and dropped it in the Drive folder</li>
        </ul>
      </div>

      <div class="qr-wrap">
        <img class="qr" src="${qrDataUrl}" alt="Login QR" />
        <div class="qr-text">
          <h3>🔐 Log in to Content Machine</h3>
          <p>Scan the code, or tap the button below → then <b>“I have a code or link”</b> → enter your code:</p>
          <div class="codes">
            <div class="code"><div class="who">Team</div><div class="val">${TEAM_CODE}</div></div>
            <div class="code"><div class="who">Doctor</div><div class="val">${DOCTOR_CODE}</div></div>
          </div>
          <a class="cta" href="${LOGIN_URL}" style="margin-top:12pt;">🔐 Open login →</a>
        </div>
      </div>
    </div>
    <div class="footer"><span>Questions? Ask the marketing team.</span><span>2 / 2</span></div>
  </section>

</body></html>`
}

async function main() {
  const qrDataUrl = await QRCode.toDataURL(LOGIN_URL, {
    margin: 1,
    width: 600,
    color: { dark: C.navy, light: '#ffffff' },
  })
  const html = buildHTML(qrDataUrl)
  await mkdir(join(root, 'samples'), { recursive: true })
  await writeFile(join(root, 'samples', 'staff-filming-guide.html'), html)

  if (!CHROME) throw new Error('No Chrome found. Set CHROME_PATH.')
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'networkidle0' })
  const outPath = join(root, 'samples', 'staff-filming-guide.pdf')
  await page.pdf({ path: outPath, format: 'A4', printBackground: true, preferCSSPageSize: true })
  await browser.close()
  console.log(`✓ wrote ${outPath}`)
  console.log(`  logo: ${LOGO_PATH ? 'embedded' : 'MISSING'} · drive: ${DRIVE_URL.slice(0, 50)}…`)
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
