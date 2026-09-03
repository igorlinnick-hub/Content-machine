// Renders the per-doctor "Welcome to Content Machine" PDF — one clean page in
// the app's own style (Inter, violet accent, no HWC dressing): login link +
// personal code, what's inside, the doctor's Drive folder links, and the
// Hello Systems LLC access terms as small print at the bottom.
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
// Output: "Hawaii Wellness Clinic/Content Machine PDFs/doctor-guide-<code>.pdf"
// (falls back to samples/ when the HWC Documents folder isn't reachable)

import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'
import puppeteer from 'puppeteer-core'

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

// ── visual system — Content Machine app style, not HWC branding ─────────
const C = {
  violet: '#7C3AED',
  ink: '#171717',
  sub: '#6B7280',
  line: '#E5E7EB',
  mist: '#F5F3FF',
}

// The deliverables live in Igor's working HWC folder (the Finder-sidebar
// one in Downloads), not in the repo's samples/. If that folder ever
// disappears, fall back to samples/ rather than fail.
const HWC_PDF_DIR = '/Users/igorlinnik/Downloads/HWC/Content Machine PDFs'
const OUT_DIR = existsSync(dirname(HWC_PDF_DIR)) ? HWC_PDF_DIR : join(root, 'samples')

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
  // Uploads inbox and Photo library deliberately absent (Igor 2026-09-03):
  // the Inbox is the team's internal door into auto-edit, and the photo
  // library feeds the Posts workspace the doctor can't see — both are
  // kitchen, not something to advertise in the doctor's handout.
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

// ── HTML — one page, Content Machine app style ──────────────────────────

function buildHTML(d) {
  const firstName = d.doctorName.replace(/^Dr\.?\s*/i, '').split(' ')[0]

  const folderRows = d.folders
    .map(
      (f) => `
      <a class="frow" href="${f.url}">
        <span class="frow-label">${f.label}</span>
        <span class="frow-sub">${f.sub}</span>
        <span class="frow-url">${f.url}</span>
      </a>`
    )
    .join('')

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  html,body { font-family:'Inter',sans-serif; color:${C.ink}; }
  .page { width:210mm; height:297mm; padding:16mm 16mm 12mm; background:#ffffff;
    display:flex; flex-direction:column; }
  .eyebrow { font-size:9pt; letter-spacing:.28em; text-transform:uppercase; color:${C.violet}; font-weight:800; }
  h1 { font-size:25pt; font-weight:800; letter-spacing:-.01em; margin-top:5pt; }
  .sub { font-size:11pt; color:${C.sub}; margin-top:3pt; }
  .card { border:1px solid ${C.line}; border-radius:12pt; padding:13pt 15pt; margin-top:11pt; }
  h2 { font-size:12.5pt; font-weight:700; margin-bottom:8pt; }
  .kv { display:flex; gap:10pt; align-items:stretch; }
  .box { flex:1; background:${C.mist}; border-radius:10pt; padding:9pt 12pt; }
  .box .k { font-size:8pt; letter-spacing:.14em; text-transform:uppercase; color:${C.violet}; font-weight:700; }
  .box .v { font-family:'SF Mono',Menlo,monospace; font-size:13pt; font-weight:700; margin-top:3pt; word-break:break-all; }
  .box .v.small { font-size:10pt; font-weight:600; padding-top:3pt; }
  .box .v a { color:${C.violet}; text-decoration:none; }
  .hint { font-size:9.5pt; color:${C.sub}; margin-top:8pt; line-height:1.55; }
  .hint a { color:${C.violet}; text-decoration:none; word-break:break-all; }
  ul { list-style:none; }
  li { font-size:10.5pt; line-height:1.75; padding-left:14pt; position:relative; }
  li::before { content:''; position:absolute; left:0; top:8.5pt; width:5pt; height:5pt; border-radius:50%; background:${C.violet}; }
  b { font-weight:700; }
  .frow { display:block; text-decoration:none; color:inherit; padding:7pt 0; border-top:1px solid ${C.line}; }
  .frow.first { border-top:none; padding-top:0; }
  .frow-label { font-size:10.5pt; font-weight:700; }
  .frow-sub { font-size:9.5pt; color:${C.sub}; margin-left:6pt; }
  .frow-url { display:block; font-family:'SF Mono',Menlo,monospace; font-size:8pt; color:${C.violet}; margin-top:2pt; word-break:break-all; }
  .terms { margin-top:auto; padding-top:10pt; border-top:1px solid ${C.line}; }
  .terms h3 { font-size:8.5pt; font-weight:700; text-transform:uppercase; letter-spacing:.1em; margin-bottom:4pt; color:#111111; }
  .terms p { font-size:7.6pt; line-height:1.55; color:#111111; }
  .foot { display:flex; justify-content:space-between; font-size:8pt; color:${C.sub}; margin-top:8pt; }
</style></head>
<body>
  <section class="page">
    <div class="eyebrow">Content Machine</div>
    <h1>Dr. ${firstName || d.doctorName}</h1>
    <p class="sub">${d.clinicName} — personal access</p>

    <div class="card">
      <h2>Log in</h2>
      <div class="kv">
        <div class="box"><div class="k">App</div><div class="v small"><a href="${APP_URL}">${APP_URL.replace('https://', '')}</a></div></div>
        <div class="box"><div class="k">Your personal code</div><div class="v">${d.code}</div></div>
      </div>
      <p class="hint">Open the app → <b>&ldquo;I have a code or link&rdquo;</b> → enter the code. Or use your
      one-tap login link: <a href="${d.installUrl}">${d.installUrl}</a><br>
      The code is personal — please don't forward it.</p>
    </div>

    <div class="card">
      <h2>What you'll find inside</h2>
      <ul>
        <li><b>Teleprompter</b> — your scripts, ready to read and record; every take uploads itself.</li>
        <li><b>My videos</b> — each take and its finished, edited version; watch, download, share.</li>
        <li>Nothing is posted anywhere without the clinic's sign-off.</li>
      </ul>
    </div>

    <div class="card">
      <h2>Your files in Google Drive</h2>
      ${folderRows.replace('class="frow"', 'class="frow first"')}
      <p class="hint">The links open for anyone on your team — no Google sign-in needed.</p>
    </div>

    <div class="terms">
      <h3>Access &amp; terms — Hello Systems LLC</h3>
      <p>The Content Machine platform is provided to ${d.clinicName} by Hello Systems LLC on a
      non-exclusive, non-transferable, month-to-month basis, active while the subscription is paid.
      The platform, its software and source code remain the property of Hello Systems LLC; access may
      not be sublicensed, resold, or shared outside the clinic. All content and materials created by or
      for the clinic — recordings, edited videos, photos, scripts — remain the clinic's property: the
      folders above always hold the current library, and a complete copy can be requested at any time.
      If access ends for any reason, Hello Systems LLC provides a full export of the clinic's content.
      Use of the platform constitutes acceptance of these terms.</p>
      <div class="foot"><span>Hello Systems LLC · Content Machine</span><span>${APP_URL.replace('https://', '')}</span></div>
    </div>
  </section>
</body></html>`
}

// ── main ────────────────────────────────────────────────────────────────

async function main() {
  const d = DRY ? placeholderData() : await loadRealData()
  const html = buildHTML(d)

  const slug = slugify(d.code || d.clinicName)
  const outPdf = OUT_OVERRIDE ?? join(OUT_DIR, `doctor-guide-${slug}.pdf`)
  await mkdir(dirname(outPdf), { recursive: true })

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

  console.log(`\n✓ wrote ${outPdf}${DRY ? '   (DRY RUN — placeholder data)' : ''}`)
  console.log(`  doctor:  ${d.doctorName} — ${d.clinicName}`)
  console.log(`  code:    ${d.code}`)
  console.log(`  install: ${d.installUrl}`)
  for (const f of d.folders) console.log(`  folder:  ${f.label} → ${f.url}`)
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
