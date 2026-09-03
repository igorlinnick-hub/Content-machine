// Renders the per-doctor "Welcome to Content Machine" PDF — personal access
// code + QR install link, teleprompter walkthrough, the doctor's own Drive
// folder links, and the Access & Terms page (Hello Systems LLC).
//
// One command does everything: reads the clinic + doctor token from Supabase
// (creating a memorable code if the token has none), makes sure the clinic's
// Drive folders open by link (anyone-with-link reader), and prints the PDF.
//
//   node --env-file=.env.vercel.local scripts/render-doctor-guide.mjs --clinic shawn
//   node --env-file=.env.vercel.local scripts/render-doctor-guide.mjs --clinic made --code hwc-made
//
// Layout preview without any credentials (placeholder data, links inert):
//   node scripts/render-doctor-guide.mjs --dry
//
// Flags:
//   --clinic <id | name substring>   which clinic (matched against id, name,
//                                    full_name, doctor_name; must be unique)
//   --code <slug>                    memorable code to set if the token has none
//   --out <path>                     output PDF path (default samples/…)
//   --skip-share                     don't touch Drive permissions
//   --no-create-token                fail instead of creating a doctor token
//   --legacy-folders                 include the legacy global Inbox/Cleaned
//                                    env folders (HWC only — they are shared
//                                    across the pre-multi-clinic setup)
//   --recordings-folder <driveId>    use this folder id for the Recordings
//                                    link instead of resolving it via Drive
//                                    (for runs without Drive OAuth env)
//
// Output: samples/doctor-guide-<code>.pdf (+ .html alongside for debugging)

import { readFileSync, existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'
import puppeteer from 'puppeteer-core'
import QRCode from 'qrcode'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// ── args ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
function flag(name) {
  return argv.includes(`--${name}`)
}
function opt(name) {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null
}
const DRY = flag('dry')
const SKIP_SHARE = flag('skip-share')
const NO_CREATE_TOKEN = flag('no-create-token')
const LEGACY_FOLDERS = flag('legacy-folders')
const CLINIC_MATCH = opt('clinic')
const WANT_CODE = opt('code')
const OUT_OVERRIDE = opt('out')
const RECORDINGS_FOLDER = opt('recordings-folder')

const APP_URL = (
  process.env.APP_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  'https://content-machine-gules.vercel.app'
).replace(/\/$/, '')

// ── visual system — same family as scripts/render-staff-guide.mjs ───────
const C = {
  navy: '#1E3A5F',
  ink: '#2B3A4A',
  blue: '#2F6BFF',
  sky: '#6BA8FF',
  mist: '#EAF2FF',
  line: '#E6EEF8',
}

// The HWC wave logo lives in-repo (assets/) — the iCloud copies under
// ~/Documents go dataless under Optimize Mac Storage and vanish from reads.
const LOGO_CANDIDATES = [
  join(root, 'assets', 'hwc-logo.png'),
  '/Users/igorlinnik/Documents/Code Projects/Hawaii Wellness Clinic/clinic-landings/HWC-Landing-pages/wellness/logo.png',
]
const LOGO_PATH = LOGO_CANDIDATES.find((p) => existsSync(p))
const LOGO_DATA = LOGO_PATH
  ? `data:image/png;base64,${readFileSync(LOGO_PATH).toString('base64')}`
  : null

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
].filter(Boolean)
const CHROME = CHROME_CANDIDATES.find((p) => existsSync(p))

// ── data loading ────────────────────────────────────────────────────────

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

async function loadRealData() {
  const { createClient } = await import('@supabase/supabase-js')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (run with --env-file)')
  if (!CLINIC_MATCH) throw new Error('Pass --clinic <id or name substring> (or --dry for a layout preview)')
  const supabase = createClient(url, key, { auth: { persistSession: false } })

  // clinic — match against id, name, full_name, doctor_name; demand a unique hit
  const { data: clinics, error: ce } = await supabase.from('clinics').select('*')
  if (ce) throw ce
  const needle = CLINIC_MATCH.toLowerCase()
  const hits = clinics.filter((c) =>
    [c.id, c.name, c.full_name, c.doctor_name]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(needle))
  )
  if (hits.length === 0)
    throw new Error(`No clinic matches "${CLINIC_MATCH}". Have: ${clinics.map((c) => c.name).join(', ')}`)
  if (hits.length > 1)
    throw new Error(`"${CLINIC_MATCH}" is ambiguous: ${hits.map((c) => c.name).join(', ')}`)
  const clinic = hits[0]

  // doctor token — prefer an active one that already has a memorable code
  const { data: tokens, error: te } = await supabase
    .from('clinic_access_tokens')
    .select('token, role, label, code, revoked_at, created_at')
    .eq('clinic_id', clinic.id)
    .eq('role', 'doctor')
    .is('revoked_at', null)
    .order('created_at', { ascending: true })
  if (te) throw te

  let row = (tokens ?? []).find((t) => t.code) ?? (tokens ?? [])[0] ?? null
  if (!row) {
    if (NO_CREATE_TOKEN) throw new Error('No active doctor token and --no-create-token was passed')
    const token = randomBytes(18).toString('base64url').slice(0, 24)
    const label = clinic.doctor_name ?? `Dr. ${clinic.name}`
    const { data: created, error: ie } = await supabase
      .from('clinic_access_tokens')
      .insert({ token, clinic_id: clinic.id, role: 'doctor', label })
      .select('token, role, label, code, revoked_at, created_at')
      .single()
    if (ie) throw ie
    row = created
    console.log(`  + created doctor token for ${label}`)
  }

  // memorable code — set one if missing (unique across active tokens)
  if (!row.code) {
    const base =
      WANT_CODE?.toLowerCase() ??
      slugify(clinic.doctor_name ?? clinic.name).replace(/^dr-?/, '') ??
      'doctor'
    let candidate = base.length >= 3 ? base : `${base}-${slugify(clinic.name)}`.slice(0, 32)
    for (let n = 2; n < 20; n++) {
      const { data: clash, error: qe } = await supabase
        .from('clinic_access_tokens')
        .select('token')
        .ilike('code', candidate)
        .is('revoked_at', null)
      if (qe) throw qe
      if (!clash?.length) break
      candidate = `${base}-${n}`
    }
    const { error: ue } = await supabase
      .from('clinic_access_tokens')
      .update({ code: candidate })
      .eq('token', row.token)
    if (ue) throw ue
    row.code = candidate
    console.log(`  + set memorable code: ${candidate}`)
  }

  // Drive — user-OAuth client (same preference as the app)
  let drive = null
  if (
    process.env.GOOGLE_DRIVE_USER_REFRESH_TOKEN &&
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
    process.env.GOOGLE_OAUTH_CLIENT_SECRET
  ) {
    const { google } = await import('googleapis')
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET
    )
    oauth2.setCredentials({ refresh_token: process.env.GOOGLE_DRIVE_USER_REFRESH_TOKEN })
    drive = google.drive({ version: 'v3', auth: oauth2 })
  }

  async function findOrCreateFolder(parentId, name) {
    const q = `mimeType = 'application/vnd.google-apps.folder' and name = '${name.replace(/'/g, "\\'")}' and trashed = false and '${parentId}' in parents`
    const res = await drive.files.list({ q, fields: 'files(id)', pageSize: 1 })
    const found = res.data.files?.[0]?.id
    if (found) return found
    const created = await drive.files.create({
      requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
      fields: 'id',
    })
    return created.data.id
  }

  // per-clinic Recordings folder (teleprompter takes)
  let recordingsFolderId = RECORDINGS_FOLDER
  if (!recordingsFolderId && drive && process.env.DRIVE_RECORDINGS_ROOT_FOLDER_ID) {
    try {
      const parent = await findOrCreateFolder(
        process.env.DRIVE_RECORDINGS_ROOT_FOLDER_ID,
        'Recordings'
      )
      recordingsFolderId = await findOrCreateFolder(parent, clinic.name)
    } catch (e) {
      console.warn(`  ! recordings folder lookup failed: ${e.message}`)
    }
  }

  const folderUrl = (id) => `https://drive.google.com/drive/folders/${id}`
  const folders = []
  if (recordingsFolderId)
    folders.push({ id: recordingsFolderId, label: 'Recordings', sub: 'Every teleprompter take, straight from the app', url: folderUrl(recordingsFolderId) })
  const finalsId = clinic.drive_finals_folder_id ?? (LEGACY_FOLDERS ? process.env.GOOGLE_DRIVE_CLIPS_CLEANED_ID : null)
  if (finalsId)
    folders.push({ id: finalsId, label: 'Finished videos', sub: 'Edited, captioned versions ready to post', url: folderUrl(finalsId) })
  const inboxId = clinic.drive_inbox_folder_id ?? (LEGACY_FOLDERS ? process.env.GOOGLE_DRIVE_CLIPS_INBOX_ID : null)
  if (inboxId)
    folders.push({ id: inboxId, label: 'Uploads inbox', sub: 'Drop raw phone videos here for editing', url: folderUrl(inboxId) })
  if (clinic.photo_library_folder_id)
    folders.push({ id: clinic.photo_library_folder_id, label: 'Photo library', sub: 'The clinic photos used across your posts', url: folderUrl(clinic.photo_library_folder_id) })
  if (clinic.drive_floor_folder_id)
    folders.push({ id: clinic.drive_floor_folder_id, label: 'Photos & clips from the floor', sub: 'What the team captures at the clinic', url: folderUrl(clinic.drive_floor_folder_id) })

  if (!clinic.drive_finals_folder_id && !LEGACY_FOLDERS)
    console.warn('  ! clinic has no provisioned Inbox/Finals folders — provision them, or pass --legacy-folders (HWC only)')

  // open the folders by link so the doctor needs no Google sign-in.
  // Share the clips ROOT (children inherit) + each directly linked folder.
  if (!SKIP_SHARE && drive) {
    const shareIds = new Set(
      [clinic.drive_root_folder_id, ...folders.map((f) => f.id)].filter(Boolean)
    )
    for (const id of shareIds) {
      try {
        await drive.permissions.create({
          fileId: id,
          requestBody: { role: 'reader', type: 'anyone' },
        })
        console.log(`  ✓ link-view set on folder ${id}`)
      } catch (e) {
        console.warn(`  ! could not share folder ${id}: ${e.message} (owned by another account?)`)
      }
    }
  } else if (!drive) {
    console.warn('  ! Drive OAuth env not set — folder permissions untouched, recordings folder skipped')
  }

  const doctorName = row.label ?? clinic.doctor_name ?? `Dr. ${clinic.name}`
  return {
    clinicName: clinic.full_name ?? clinic.name,
    doctorName,
    code: row.code,
    installUrl: `${APP_URL}/c/${row.token}`,
    folders: folders.map(({ label, sub, url }) => ({ label, sub, url })),
  }
}

function placeholderData() {
  return {
    clinicName: 'Sample Wellness Clinic',
    doctorName: 'Dr. Sample',
    code: 'sample-code',
    installUrl: `${APP_URL}/c/preview-token`,
    folders: [
      { label: 'Recordings', sub: 'Every teleprompter take, straight from the app', url: '#' },
      { label: 'Finished videos', sub: 'Edited, captioned versions ready to post', url: '#' },
      { label: 'Uploads inbox', sub: 'Drop raw phone videos here for editing', url: '#' },
      { label: 'Photo library', sub: 'The clinic photos used across your posts', url: '#' },
    ],
  }
}

// ── HTML ────────────────────────────────────────────────────────────────

function step(num, title, body) {
  return `
  <div class="step">
    <div class="step-num">${num}</div>
    <div class="step-body"><h3>${title}</h3>${body}</div>
  </div>`
}

function buildHTML(d, qrDataUrl, videosQrDataUrl) {
  const firstName = d.doctorName.replace(/^Dr\.?\s*/i, '').split(' ')[0]
  const footer = (page) => `
    <div class="footer"><span>Hello Systems · Content Machine — ${d.clinicName}</span><span>${page} / 4</span></div>`

  const folderCards = d.folders
    .map(
      (f) => `
      <a class="folder" href="${f.url}">
        <div class="folder-icon">▸</div>
        <div><div class="folder-label">${f.label}</div>
        <div class="folder-sub">${f.sub}</div></div>
      </a>`
    )
    .join('')

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  html,body { font-family:'Inter',sans-serif; color:${C.ink}; }
  .page { position:relative; width:210mm; height:297mm; padding:20mm 18mm;
    background:#ffffff; overflow:hidden; page-break-after:always; }
  .page:last-child { page-break-after:auto; }
  .blob { position:absolute; border-radius:50%; filter:blur(60px); opacity:.55; }
  .b1 { width:150mm; height:150mm; background:${C.sky};  right:-55mm; top:-60mm; }
  .b2 { width:120mm; height:120mm; background:${C.mist}; left:-50mm;  bottom:-45mm; opacity:.9; }
  .b3 { width:90mm;  height:90mm;  background:${C.blue}; right:-30mm; bottom:-30mm; opacity:.18; }
  .wrap { position:relative; z-index:1; }
  .logo { height:15mm; margin-bottom:10pt; }
  .eyebrow { font-size:9.5pt; letter-spacing:.24em; text-transform:uppercase; color:${C.blue}; font-weight:700; }
  h1 { font-family:'Playfair Display',serif; font-size:31pt; line-height:1.08; color:${C.navy}; font-weight:700; margin-top:7pt; }
  h1 .accent { color:${C.blue}; }
  .lede { font-size:12pt; margin-top:11pt; max-width:152mm; line-height:1.55; }
  .rule { height:3px; width:52mm; background:linear-gradient(90deg,${C.blue},${C.sky}); border-radius:3px; margin:14pt 0 18pt; }
  .step { display:flex; gap:14pt; margin-bottom:16pt; align-items:flex-start; }
  .step-num { flex:0 0 auto; width:30pt; height:30pt; border-radius:50%;
    background:linear-gradient(135deg,${C.blue},${C.sky}); color:#fff;
    font-family:'Playfair Display',serif; font-weight:700; font-size:15pt;
    display:flex; align-items:center; justify-content:center; }
  .step-body h3 { font-family:'Playfair Display',serif; font-size:16pt; color:${C.navy}; margin-bottom:5pt; }
  ul { list-style:none; margin-top:5pt; }
  li { font-size:11pt; line-height:1.6; padding-left:16pt; position:relative; }
  li::before { content:''; position:absolute; left:0; top:7pt; width:6pt; height:6pt; border-radius:50%; background:${C.sky}; }
  b { color:${C.navy}; }
  .pill { display:inline-block; background:${C.mist}; color:${C.navy}; border-radius:999px;
    padding:3pt 10pt; font-size:9.5pt; font-weight:600; margin:4pt 4pt 0 0; }
  .card { background:rgba(255,255,255,.75); border:1px solid ${C.line}; border-radius:16pt;
    padding:16pt 18pt; box-shadow:0 8pt 30pt rgba(47,107,255,.08); }
  .footer { position:absolute; z-index:1; left:18mm; right:18mm; bottom:14mm;
    font-size:8.5pt; color:${C.sky}; display:flex; justify-content:space-between;
    border-top:1px solid ${C.line}; padding-top:8pt; }
  .qr-wrap { display:flex; gap:18pt; align-items:center; }
  .qr-wrap img.qr { width:46mm; height:46mm; border:8px solid #fff; border-radius:12pt;
    box-shadow:0 8pt 26pt rgba(47,107,255,.16); }
  .qr-text h3 { font-family:'Playfair Display',serif; color:${C.navy}; font-size:18pt; margin-bottom:6pt; }
  .qr-text p { font-size:11pt; line-height:1.5; }
  .code-box { background:${C.mist}; border:1px solid ${C.line}; border-radius:10pt; padding:9pt 14pt; margin-top:9pt; display:inline-block; }
  .code-box .who { font-size:8.5pt; letter-spacing:.1em; text-transform:uppercase; color:${C.blue}; font-weight:700; }
  .code-box .val { font-family:monospace; font-size:17pt; font-weight:700; color:${C.navy}; margin-top:2pt; }
  .link { font-family:monospace; font-size:9pt; color:${C.blue}; word-break:break-all; }

  .folders { display:grid; grid-template-columns:1fr 1fr; gap:10pt; margin-top:10pt; }
  .folder { display:flex; gap:10pt; align-items:flex-start; text-decoration:none;
    background:rgba(255,255,255,.8); border:1px solid ${C.line}; border-radius:12pt; padding:11pt 13pt; }
  .folder-icon { flex:0 0 auto; width:22pt; height:22pt; border-radius:8pt; color:#fff; font-size:11pt;
    background:linear-gradient(135deg,${C.blue},${C.sky}); display:flex; align-items:center; justify-content:center; }
  .folder-label { font-size:11.5pt; font-weight:700; color:${C.navy}; }
  .folder-sub { font-size:9.5pt; color:${C.ink}; margin-top:2pt; line-height:1.4; }

  .terms h2 { font-family:'Playfair Display',serif; font-size:24pt; color:${C.navy}; }
  .terms .intro { font-size:10.5pt; line-height:1.6; margin-top:8pt; max-width:155mm; }
  .clause { display:flex; gap:12pt; margin-top:13pt; }
  .clause-num { flex:0 0 auto; font-family:'Playfair Display',serif; font-weight:700; font-size:13pt; color:${C.blue}; width:16pt; }
  .clause h4 { font-size:11.5pt; color:${C.navy}; margin-bottom:3pt; }
  .clause p { font-size:10.5pt; line-height:1.55; }
  .clause.hl { background:${C.mist}; border:1px solid ${C.line}; border-radius:12pt; padding:11pt 13pt 11pt 13pt; margin-left:-13pt; }
</style></head>
<body>

  <!-- PAGE 1 — welcome + login -->
  <section class="page">
    <div class="blob b1"></div><div class="blob b2"></div>
    <div class="wrap">
      ${LOGO_DATA ? `<img class="logo" src="${LOGO_DATA}" alt=""/>` : ''}
      <div class="eyebrow">Content Machine · Personal access</div>
      <h1>${firstName ? `Dr. ${firstName}` : d.doctorName}, your <span class="accent">content studio</span> is ready</h1>
      <p class="lede">Content Machine writes your scripts, runs your teleprompter,
        keeps every take you record, and hands the finished videos back to you —
        all in one place, on your phone. Setup takes two minutes.</p>
      <div class="rule"></div>

      <div class="qr-wrap">
        <img class="qr" src="${qrDataUrl}" alt="Personal login QR" />
        <div class="qr-text">
          <h3>Log in — scan with your phone</h3>
          <p>Scanning signs this phone in automatically — no password, nothing to remember.
          On a computer, open the site and choose <b>“I have a code or link”</b>, then type your code:</p>
          <div class="code-box"><div class="who">Your personal code</div><div class="val">${d.code}</div></div>
          <p style="margin-top:8pt;" class="link">${APP_URL}</p>
        </div>
      </div>

      <div class="card" style="margin-top:16pt;">
        <p style="font-size:11pt; line-height:1.6;"><b>Tip — make it feel like an app:</b>
        after logging in on your phone, tap <b>Share → Add to Home Screen</b>.
        Content Machine opens full-screen from its own icon, like any other app.</p>
        <div style="margin-top:6pt;">
          <span class="pill">Your code is personal — please don't forward it</span>
          <span class="pill">Works on any phone or computer</span>
        </div>
      </div>
    </div>
    ${footer(1)}
  </section>

  <!-- PAGE 2 — record -->
  <section class="page">
    <div class="blob b1" style="left:-55mm;right:auto;top:-55mm;"></div>
    <div class="blob b3"></div>
    <div class="wrap">
      ${LOGO_DATA ? `<img class="logo" src="${LOGO_DATA}" alt=""/>` : ''}
      <div class="eyebrow">Recording</div>
      <h1 style="font-size:26pt;">Open the teleprompter. <span class="accent">Read. Done.</span></h1>
      <div class="rule"></div>

      ${step('1', 'Pick a script', `
        <ul>
          <li>From the dashboard, open the <b>Teleprompter</b>.</li>
          <li>Your scripts are already there — written for you and refreshed by the team.</li>
          <li>Pick one, skim it once, and you're ready.</li>
        </ul>`)}

      ${step('2', 'Record', `
        <ul>
          <li>The script <b>scrolls on screen while the camera records</b> — just read naturally.</li>
          <li>Do <b>2–3 takes</b>; keep whichever felt best. Takes are short — under a minute.</li>
          <li>Tap <b>save</b> — the video uploads by itself. Nothing to export, nothing to send.</li>
        </ul>`)}

      ${step('3', 'The team takes it from there', `
        <ul>
          <li>Your take lands in <b>My videos</b> the moment the upload finishes.</li>
          <li>The team edits it — cuts, captions, polish — and the <b>finished version appears
              right next to your raw take</b>.</li>
          <li>Nothing is posted anywhere without the clinic's sign-off.</li>
        </ul>`)}

      <div class="card">
        <p class="eyebrow" style="margin-bottom:8pt;">Thirty-second filming checklist</p>
        <div>
          <span class="pill">Face a window — light on you, not behind you</span>
          <span class="pill">Quiet room, phone close for sound</span>
          <span class="pill">Wipe the lens</span>
          <span class="pill">Natural pace — the prompter follows you</span>
        </div>
      </div>

      <div class="card" style="margin-top:14pt;">
        <p style="font-size:11pt; line-height:1.6;"><b>Want to cover something specific?</b>
        A treatment you love, a question patients keep asking — tell the team, and your
        next script will be about exactly that.</p>
      </div>
    </div>
    ${footer(2)}
  </section>

  <!-- PAGE 3 — your videos & your files -->
  <section class="page">
    <div class="blob b1"></div><div class="blob b2"></div>
    <div class="wrap">
      ${LOGO_DATA ? `<img class="logo" src="${LOGO_DATA}" alt=""/>` : ''}
      <div class="eyebrow">Your library</div>
      <h1 style="font-size:26pt;">Every video, every photo — <span class="accent">always yours</span></h1>
      <p class="lede" style="font-size:11pt;">Open <b>My videos</b> in the app to watch any take or finished
        edit right there. Tap <b>“Open in Drive”</b> on any video to download or share it. And your source
        material lives in your own Google Drive folders — open them any time, from any device:</p>
      <div class="rule"></div>

      <div class="folders">${folderCards}</div>

      <div class="card" style="margin-top:14pt;">
        <p style="font-size:11pt; line-height:1.6;"><b>These folders are yours.</b>
        The links open for anyone on your team — no Google sign-in needed. Everything the platform
        records or produces for the clinic stays the clinic's property, and you can ask for a full
        copy of all of it at any time. The details are on the last page.</p>
      </div>

      <div class="qr-wrap" style="margin-top:18pt;">
        <img class="qr" style="width:34mm;height:34mm;" src="${videosQrDataUrl}" alt="My videos QR" />
        <div class="qr-text">
          <h3 style="font-size:15pt;">Straight to your library</h3>
          <p>Scan to open <b>My videos</b> on your phone — watch any take,
          download the finished versions, jump into your Drive folders.</p>
          <p style="margin-top:6pt;" class="link">${APP_URL}/videos</p>
        </div>
      </div>
    </div>
    ${footer(3)}
  </section>

  <!-- PAGE 4 — access & terms -->
  <section class="page terms">
    <div class="blob b2" style="left:auto; right:-50mm;"></div>
    <div class="wrap">
      ${LOGO_DATA ? `<img class="logo" src="${LOGO_DATA}" alt=""/>` : ''}
      <div class="eyebrow">Access &amp; Terms</div>
      <h2>The terms your access comes with</h2>
      <p class="intro">The Content Machine platform is provided to <b>${d.clinicName}</b> by
        <b>Hello Systems LLC</b>. Using the platform means these terms are accepted — there is
        nothing to sign.</p>
      <div class="rule"></div>

      <div class="clause">
        <div class="clause-num">1</div>
        <div><h4>License</h4>
        <p>Hello Systems LLC grants ${d.clinicName} a non-exclusive, non-transferable right to use
        the Content Machine platform to create and manage the clinic's own content.</p></div>
      </div>

      <div class="clause">
        <div class="clause-num">2</div>
        <div><h4>Term</h4>
        <p>Access runs month-to-month and stays active while the subscription is paid.</p></div>
      </div>

      <div class="clause hl">
        <div class="clause-num">3</div>
        <div><h4>Your content stays yours</h4>
        <p>All content and materials created by or for the clinic — recordings, edited videos,
        photos, scripts — remain the clinic's property. The Drive folders on page 3 always hold
        the current library, and a complete copy can be requested at any time.</p></div>
      </div>

      <div class="clause hl">
        <div class="clause-num">4</div>
        <div><h4>If access ever ends</h4>
        <p>Should access end for any reason, Hello Systems LLC provides a full export of the
        clinic's content. Nothing is ever lost by leaving.</p></div>
      </div>

      <div class="clause">
        <div class="clause-num">5</div>
        <div><h4>The platform</h4>
        <p>The platform, its software and source code remain the property of Hello Systems LLC.
        No ownership transfers; access may not be sublicensed, resold, or shared outside the
        clinic.</p></div>
      </div>

      <div class="clause">
        <div class="clause-num">6</div>
        <div><h4>Acceptance</h4>
        <p>Use of the platform constitutes acceptance of these terms. Questions are always
        welcome — just ask.</p></div>
      </div>
    </div>
    ${footer(4)}
  </section>

</body></html>`
}

// ── main ────────────────────────────────────────────────────────────────

async function main() {
  const d = DRY ? placeholderData() : await loadRealData()

  const qrOpts = { margin: 1, width: 640, color: { dark: C.navy, light: '#ffffff' } }
  const qrDataUrl = await QRCode.toDataURL(d.installUrl, qrOpts)
  const videosQrDataUrl = await QRCode.toDataURL(`${APP_URL}/videos`, qrOpts)
  const html = buildHTML(d, qrDataUrl, videosQrDataUrl)

  const slug = slugify(d.code || d.clinicName)
  const outPdf = OUT_OVERRIDE ?? join(root, 'samples', `doctor-guide-${slug}.pdf`)
  await mkdir(dirname(outPdf), { recursive: true })
  await writeFile(outPdf.replace(/\.pdf$/, '.html'), html)

  if (!CHROME) throw new Error('No Chrome found. Set CHROME_PATH.')
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    await page.pdf({ path: outPdf, format: 'A4', printBackground: true, preferCSSPageSize: true })
  } finally {
    await browser.close()
  }

  console.log(`\n✓ wrote ${outPdf}`)
  console.log(`  doctor:  ${d.doctorName} — ${d.clinicName}`)
  console.log(`  code:    ${d.code}`)
  console.log(`  install: ${d.installUrl}`)
  for (const f of d.folders) console.log(`  folder:  ${f.label} → ${f.url}`)
  console.log(`  logo:    ${LOGO_PATH ? 'embedded' : 'MISSING'}${DRY ? '   (DRY RUN — placeholder data)' : ''}`)
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
