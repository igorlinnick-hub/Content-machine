#!/usr/bin/env node
// Queue a brand's X and LinkedIn posts into zernio_feed (migration 067). The
// daily cron /api/cron/zernio-feed (15:00 UTC) hands Zernio every row due in
// the next 14 days; Zernio publishes at due_at. Status lives in Zernio — read it
// with `list`, not SQL.
//
//   node scripts/zernio-feed.mjs plan <plan.json> --brand hiredrop [--plan 1] [--dry] [--force]
//        posts with platform x | linkedin (and due_at) → rows; a source already queued is skipped.
//        Post fields: id, platform, due_at, text, first_comment (LinkedIn),
//        document_url / document_title / document_pages (LinkedIn document post).
//        A document post without document_url is queued but held until `doc` gives it the PDF.
//   node scripts/zernio-feed.mjs doc <source> <file.pdf | https-url> --brand hiredrop [--title "…"]
//   node scripts/zernio-feed.mjs list --brand hiredrop
//   node scripts/zernio-feed.mjs move <source> <iso-time> --brand hiredrop   # also moves it in Zernio
//   node scripts/zernio-feed.mjs drop <source> --brand hiredrop              # also deletes it in Zernio
//   node scripts/zernio-feed.mjs tick                                         # run the cron now (prod)
//
// Checks before a row goes in (--force skips them): slop check; X ≤ 280 weighted
// (X counts every link as 23, CJK/arrows/emoji as 2, and links bare domains like
// jobs.lever.co); X without links ($0.20 a post instead of $0.015); brand bans.
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const PROJECT_REF = 'pscqjvkuqqmvmcbxdwtu'
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`
const ZERNIO = 'https://zernio.com/api/v1'
const CRON_URL = 'https://content-machine-gules.vercel.app/api/cron/zernio-feed'
const CHANNELS = ['x', 'linkedin']

const BRANDS = {
  hiredrop: {
    bucket: 'hiredrop-posts',
    // hiredrop-content.md / profiles.md §1: the LinkedIn page risk — never name
    // LinkedIn, Easy Apply, auto-apply; HireDrop itself stays out of posts (Igor 28.10).
    banned: { linkedin: [/linkedin/i, /easy apply/i, /auto-?apply/i, /hiredrop/i], x: [/hiredrop/i] },
  },
}

const argv = process.argv.slice(2)
const cmd = argv[0]
const flag = (name) => argv.includes(`--${name}`)
const opt = (name, dflt) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : dflt
}
const DRY = flag('dry')
const FORCE = flag('force')

function die(msg) {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

function envLocal(name) {
  if (process.env[name]) return process.env[name]
  try {
    const env = fs.readFileSync(fileURLToPath(new URL('../.env.local', import.meta.url)), 'utf8')
    return env.match(new RegExp(`^${name}=["']?([^"'\\n]+)`, 'm'))?.[1] ?? null
  } catch {
    return null
  }
}

function serviceKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY
  const out = execFileSync('supabase', ['projects', 'api-keys', '--project-ref', PROJECT_REF, '-o', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  const k = JSON.parse(out).find((x) => x.name === 'service_role')?.api_key
  if (!k) die('no service_role key — set SUPABASE_SERVICE_ROLE_KEY or log in to the supabase CLI')
  return k
}

let KEY
async function rest(method, route, body, headers = {}) {
  KEY ??= serviceKey()
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${route}`, {
    method,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${route}: ${res.status} ${text}`)
  return text ? JSON.parse(text) : null
}

async function zernio(method, route, body) {
  const token = envLocal('ZERNIO_API_KEY') ?? die('no ZERNIO_API_KEY in env or .env.local')
  const res = await fetch(`${ZERNIO}${route}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const j = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`Zernio ${method} ${route}: ${res.status} ${j?.error ?? j?.message ?? ''}`)
  return j
}

async function clinicFor(brand) {
  if (!BRANDS[brand]) die(`unknown brand "${brand}" — add it to BRANDS (and lib/publish/zernio.ts)`)
  const rows = await rest('GET', `clinics?niche=eq.${encodeURIComponent(brand)}&select=id,name`)
  if (rows.length !== 1) die(`expected one clinic with niche "${brand}", found ${rows.length}`)
  return rows[0]
}

async function rowFor(clinicId, source) {
  const [row] = await rest('GET', `zernio_feed?clinic_id=eq.${clinicId}&source=eq.${encodeURIComponent(source)}&select=*`)
  return row ?? die(`no row ${source}`)
}

// ── checks ───────────────────────────────────────────────────────────────────

const SLOP = fileURLToPath(new URL('./slop-check.mjs', import.meta.url))
function slopCheck(text) {
  try {
    execFileSync(process.execPath, [SLOP, '--text', text], { encoding: 'utf8' })
    return null
  } catch (e) {
    return (e.stdout || String(e)).trim()
  }
}

// What X turns into a link: a protocol URL, or a bare domain with a common TLD.
const LINK = /\bhttps?:\/\/\S+|\b(?:[a-z0-9-]+\.)+(?:com|io|org|net|co|ai|dev|app|gov|edu|us|fyi|ly|me|so|xyz)\b(?:\/\S*)?/gi

/** X's weighted length (twitter-text v3): links 23, chars outside the Latin/punctuation ranges 2. */
function xLength(text) {
  let n = 0
  const rest = text.normalize('NFC').replace(LINK, () => {
    n += 23
    return ''
  })
  for (const ch of rest) {
    const c = ch.codePointAt(0)
    const light = c <= 0x10ff || (c >= 0x2000 && c <= 0x200d) || (c >= 0x2010 && c <= 0x201f) || (c >= 0x2032 && c <= 0x2037)
    n += light ? 1 : 2
  }
  return n
}

function problems(brand, channel, text) {
  const out = []
  for (const re of BRANDS[brand].banned[channel] ?? []) if (re.test(text)) out.push(`banned on ${channel}: ${re}`)
  if (channel === 'x') {
    const links = text.match(LINK) ?? []
    if (links.length) out.push(`X links ${links.join(', ')} — a post with a link costs $0.20, not $0.015`)
    const n = xLength(text)
    if (n > 280) out.push(`X length ${n} > 280 (links count 23 each)`)
  }
  const slop = slopCheck(text)
  if (slop) out.push(`slop:\n${slop}`)
  return out
}

// ── commands ─────────────────────────────────────────────────────────────────

const firstSentence = (s) => s.split(/(?<=[.!?])\s/)[0].replace(/[.!?]$/, '')

async function plan() {
  const file = argv[1] ?? die('plan <plan.json> --brand <brand>')
  const brand = opt('brand') ?? die('--brand required')
  const only = opt('plan')
  const clinic = await clinicFor(brand)
  const posts = JSON.parse(fs.readFileSync(file, 'utf8')).posts.filter(
    (p) => CHANNELS.includes(p.platform) && p.due_at && (only == null || String(p.plan) === String(only)),
  )
  const existing = new Set((await rest('GET', `zernio_feed?clinic_id=eq.${clinic.id}&select=source`)).map((r) => r.source))
  let seq = (await rest('GET', `zernio_feed?clinic_id=eq.${clinic.id}&select=seq&order=seq.desc&limit=1`))[0]?.seq ?? 0
  let added = 0
  let refused = 0
  for (const p of posts) {
    const source = `${brand}:${p.platform}-${p.id}`
    if (existing.has(source)) {
      console.log(`  skip ${source} (already queued)`)
      continue
    }
    if (Date.parse(p.due_at) < Date.now()) console.log(`  ! ${source} is past due — the cron moves it to the next free day`)
    const bad = problems(brand, p.platform, p.text)
    if (bad.length && !FORCE) {
      console.log(`  ✗ ${source} not queued:\n    ${bad.join('\n    ')}`)
      refused++
      continue
    }
    const isDoc = Boolean(p.document_url || p.document_pages || p.document_title)
    const row = {
      clinic_id: clinic.id,
      seq: ++seq,
      source,
      channel: p.platform,
      text: p.text,
      media_urls: p.document_url ? [p.document_url] : [],
      document_title: isDoc ? (p.document_title ?? firstSentence(p.document_pages?.[0] ?? p.id)) : null,
      first_comment: p.platform === 'linkedin' ? (p.first_comment ?? null) : null,
      due_at: p.due_at,
    }
    const notes = [
      isDoc && !p.document_url ? `held until: zernio-feed.mjs doc ${source} <pdf>` : '',
      p.pin ? 'pin it by hand once it is out (the X API cannot pin)' : '',
    ].filter(Boolean)
    if (!DRY) await rest('POST', 'zernio_feed', row, { Prefer: 'return=minimal' })
    added++
    console.log(`  ${DRY ? 'dry' : '✓'} ${source} ${p.due_at}${notes.length ? `  — ${notes.join('; ')}` : ''}`)
  }
  console.log(`${added} queued${refused ? `, ${refused} refused (fix the text or --force)` : ''} · ${clinic.name}`)
}

async function doc() {
  const [, source, input] = argv
  if (!source || !input) die('doc <source> <file.pdf | https-url> --brand <brand>')
  const brand = opt('brand') ?? die('--brand required')
  const clinic = await clinicFor(brand)
  const row = await rowFor(clinic.id, source)
  if (row.status !== 'pending') die(`${source} is ${row.status} — the PDF can only go on a pending row`)
  let url = input
  if (!/^https:\/\//.test(input)) {
    if (!fs.existsSync(input) || path.extname(input).toLowerCase() !== '.pdf') die(`not a PDF: ${input}`)
    // New prefix every upload: the CDN keeps serving an old file at the same path.
    const object = `docs/${Date.now().toString(36)}/${path.basename(input).toLowerCase().replace(/[^a-z0-9.]+/g, '-')}`
    KEY ??= serviceKey()
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BRANDS[brand].bucket}/${object}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/pdf', 'x-upsert': 'true' },
      body: fs.readFileSync(input),
    })
    if (!res.ok) die(`upload: ${res.status} ${await res.text()}`)
    url = `${SUPABASE_URL}/storage/v1/object/public/${BRANDS[brand].bucket}/${object}`
  }
  const patch = { media_urls: [url], document_title: opt('title') ?? row.document_title ?? source, last_error: null }
  await rest('PATCH', `zernio_feed?id=eq.${row.id}`, { ...patch, updated_at: new Date().toISOString() })
  console.log(`✓ ${source} ← ${url}\n  title: ${patch.document_title}`)
}

async function list() {
  const brand = opt('brand') ?? die('--brand required')
  const clinic = await clinicFor(brand)
  const rows = await rest(
    'GET',
    `zernio_feed?clinic_id=eq.${clinic.id}&status=neq.cancelled&select=source,channel,due_at,status,zernio_post_id,last_error,media_urls,document_title&order=due_at`,
  )
  for (const r of rows) {
    let s = r.status
    let link = ''
    let err = r.last_error ?? ''
    if (r.zernio_post_id) {
      try {
        const { post } = await zernio('GET', `/posts/${r.zernio_post_id}`)
        const t = post.platforms?.[0] ?? {}
        s = t.status === 'pending' ? 'scheduled' : (t.status ?? post.status)
        link = t.platformPostUrl ?? ''
        err = t.errorMessage ?? ''
      } catch (e) {
        s = '?'
        err = e.message
      }
    } else if (r.document_title && !r.media_urls.length) s = 'needs-pdf'
    console.log(`${r.due_at.slice(0, 16)}  ${s.padEnd(10)} ${r.channel.padEnd(9)} ${r.source}${link ? `  ${link}` : ''}${err ? `  ✗ ${err}` : ''}`)
  }
  console.log(`${rows.length} row(s) · pending = still here, goes to Zernio when due within 14 days`)
}

async function move() {
  const [, source, at] = argv
  if (!source || !at) die('move <source> <iso-time> --brand <brand>')
  const when = new Date(at)
  if (Number.isNaN(when.getTime())) die(`bad time: ${at}`)
  if (when.getTime() < Date.now() + 60 * 60_000) die('pick a time at least an hour ahead (a past time would publish at once)')
  const brand = opt('brand') ?? die('--brand required')
  const clinic = await clinicFor(brand)
  const row = await rowFor(clinic.id, source)
  if (row.status === 'cancelled') die(`${source} is cancelled`)
  if (row.zernio_post_id) {
    await zernio('PUT', `/posts/${row.zernio_post_id}`, { scheduledFor: when.toISOString(), timezone: 'UTC' })
  }
  await rest('PATCH', `zernio_feed?id=eq.${row.id}`, { due_at: when.toISOString(), updated_at: new Date().toISOString() })
  console.log(`✓ ${source} → ${when.toISOString()}${row.zernio_post_id ? ' (moved in Zernio too)' : ''}`)
}

async function drop() {
  const source = argv[1] ?? die('drop <source> --brand <brand>')
  const brand = opt('brand') ?? die('--brand required')
  const clinic = await clinicFor(brand)
  const row = await rowFor(clinic.id, source)
  if (row.zernio_post_id) await zernio('DELETE', `/posts/${row.zernio_post_id}`)
  await rest('PATCH', `zernio_feed?id=eq.${row.id}`, { status: 'cancelled', updated_at: new Date().toISOString() })
  console.log(`✓ ${source} cancelled${row.zernio_post_id ? ' and deleted in Zernio' : ''}`)
}

async function tick() {
  const [secret] = await rest('GET', 'app_secrets?name=eq.meta_publish_cron&select=value')
  const res = await fetch(CRON_URL, { method: 'POST', headers: { 'x-cron-key': secret.value, 'Content-Type': 'application/json' }, body: '{}' })
  console.log(res.status, JSON.stringify(await res.json().catch(() => null), null, 1))
}

const COMMANDS = { plan, doc, list, move, drop, tick }
if (!COMMANDS[cmd]) die(`usage: zernio-feed.mjs ${Object.keys(COMMANDS).join('|')} … (see the header)`)
await COMMANDS[cmd]()
