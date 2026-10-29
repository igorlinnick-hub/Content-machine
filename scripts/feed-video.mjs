#!/usr/bin/env node
// Queue finished videos: TikTok through the Buffer feeder (buffer_feed),
// Instagram Reels straight through the Meta Graph API (meta_posts).
// Uploads the mp4 (and cover) to the brand's public bucket, then adds the rows.
// Also Instagram Stories (images, meta_posts kind 'story'). Contract: docs/VIDEO-FEED.md.
//
//   node scripts/feed-video.mjs drop <folder> --brand hiredrop [--every 2] [--hour 16] [--notify]
//        every <name>.mp4 that has <name>.caption.txt next to it → next free slot
//        (every other day after the last queued video); done files move to <folder>/queued/
//   node scripts/feed-video.mjs add --brand hiredrop --video reel.mp4 \
//        --caption "text…" --at 2026-10-12T16:00:00Z [--channels tiktok,instagram]
//        [--cover cover.jpg] [--ai] [--source my-id] [--dry]
//   node scripts/feed-video.mjs plan month.json [--dry]   # explicit dates
//   node scripts/feed-video.mjs list --brand hiredrop
//   node scripts/feed-video.mjs stories <folder> --brand hiredrop --start 2026-10-26T13:00:00Z \
//        [--every-min 60] [--only 1-10] [--name my-story] [--dry]
//        every NN-slug.png/jpg in name order → one Instagram Story every --every-min minutes;
//        PNG becomes JPEG q95 (Instagram takes JPEG only), the folder itself is not touched
//
// The caption goes through the slop check (scripts/slop-check.mjs); hits stop
// the video unless --force. Re-running is safe: a source already queued is skipped.
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const PROJECT_REF = 'pscqjvkuqqmvmcbxdwtu'
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`
// Public bucket per brand. A brand missing here can't take videos yet.
const BUCKETS = { hiredrop: 'hiredrop-posts' }
const CHANNELS = ['tiktok', 'instagram']
const DAY = 86_400_000

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

async function clinicFor(brand) {
  const rows = await rest('GET', `clinics?niche=eq.${encodeURIComponent(brand)}&select=id,name`)
  if (rows.length !== 1) die(`expected one clinic with niche "${brand}", found ${rows.length}`)
  return rows[0]
}

function probe(file) {
  try {
    const out = execFileSync(
      'ffprobe',
      ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', file],
      { encoding: 'utf8' },
    )
    const j = JSON.parse(out)
    const audio = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim()
    return { w: j.streams?.[0]?.width, h: j.streams?.[0]?.height, sec: Number(j.format?.duration), audio: Boolean(audio) }
  } catch {
    return null // no ffprobe — skip the shape check
  }
}

async function upload(bucket, local, objectPath, contentType) {
  KEY ??= serviceKey()
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${objectPath}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': contentType, 'x-upsert': 'true' },
    body: fs.readFileSync(local),
  })
  if (!res.ok) throw new Error(`upload ${objectPath}: ${res.status} ${await res.text()}`)
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${objectPath}`
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const SLOP = fileURLToPath(new URL('./slop-check.mjs', import.meta.url))

function slopCheck(caption) {
  try {
    execFileSync(process.execPath, [SLOP, '--text', caption], { encoding: 'utf8' })
    return null
  } catch (e) {
    return (e.stdout || String(e)).trim()
  }
}

// ── what is already queued ───────────────────────────────────────────────────

async function queued(clinicId) {
  const [feed, meta] = await Promise.all([
    rest('GET', `buffer_feed?clinic_id=eq.${clinicId}&status=neq.cancelled&select=source,channels,due_at,video_url,status,last_error,buffer_ids`),
    rest('GET', `meta_posts?clinic_id=eq.${clinicId}&status=not.in.(cancelled,failed)&select=source,network,kind,publish_at,video_url,status,last_error,permalink`),
  ])
  return { feed, meta }
}

const dayKey = (t) => new Date(t).toISOString().slice(0, 10)

/** Days that already carry an Instagram post, and when the last video goes out. */
function calendar({ feed, meta }) {
  const igDays = new Set([
    // Stories never land on the grid, so they don't take the day.
    ...meta.filter((m) => m.network === 'instagram' && m.kind !== 'story').map((m) => dayKey(m.publish_at)),
    ...feed.filter((f) => f.channels.includes('instagram')).map((f) => dayKey(f.due_at)),
  ])
  const videoTimes = [
    ...feed.filter((f) => f.video_url).map((f) => Date.parse(f.due_at)),
    ...meta.filter((m) => m.video_url).map((m) => Date.parse(m.publish_at)),
  ]
  return { igDays, lastVideo: videoTimes.length ? Math.max(...videoTimes) : null }
}

/**
 * Next slot: `every` days after the last video, at `hour`:00 UTC. A day that
 * already has an Instagram post (a carousel) is skipped when the video goes to
 * Instagram too, so the grid gets one post a day instead of two.
 */
function nextSlot(cal, { every, hour, channels }) {
  const firstFree = Date.now() + 2 * 3_600_000
  let t
  if (cal.lastVideo && cal.lastVideo + every * DAY > firstFree) {
    t = cal.lastVideo + every * DAY
  } else {
    const d = new Date(firstFree)
    t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour)
    if (t < firstFree) t += DAY
  }
  if (channels.includes('instagram')) {
    for (let i = 0; i < every - 1 && cal.igDays.has(dayKey(t)); i++) t += DAY
  }
  return t
}

// ── one video ────────────────────────────────────────────────────────────────

async function addOne(brand, clinic, item, baseDir, q) {
  const channels = (item.channels ?? ['tiktok', 'instagram']).map((c) => c.trim()).filter(Boolean)
  const bad = channels.filter((c) => !CHANNELS.includes(c))
  if (bad.length) throw new Error(`unknown channel(s): ${bad.join(', ')} — videos go to ${CHANNELS.join(' / ')}`)
  if (!item.video) throw new Error('video required')
  if (!item.caption?.trim()) throw new Error('caption required')
  const at = new Date(item.at)
  if (!item.at || Number.isNaN(at.getTime())) throw new Error(`bad time "${item.at}" (ISO, e.g. 2026-10-12T16:00:00Z)`)

  const isUrl = (s) => /^https?:\/\//.test(s)
  const videoLocal = isUrl(item.video) ? null : path.resolve(baseDir, item.video)
  if (videoLocal && !fs.existsSync(videoLocal)) throw new Error(`no such file: ${videoLocal}`)
  const name = item.source ?? slug(path.basename(item.video, path.extname(item.video)))
  const source = `video:${name}`

  if (q.feed.some((f) => f.source === source) || q.meta.some((m) => m.source === source)) {
    console.log(`  = ${source} already queued — skipped`)
    return { skipped: true }
  }

  if (videoLocal) {
    const p = probe(videoLocal)
    if (p?.w && p?.h && Math.abs(p.w / p.h - 9 / 16) > 0.02) console.warn(`  ! ${path.basename(videoLocal)} is ${p.w}×${p.h}, not 9:16`)
    if (p?.sec && p.sec < 3) throw new Error(`${path.basename(videoLocal)} is ${p.sec.toFixed(1)}s — TikTok wants at least 3s`)
    if (p && !p.audio) console.warn(`  ! ${path.basename(videoLocal)} has no audio track — it will post silent (sound can't be added after)`)
    if (p?.sec && p.sec > 180) console.warn(`  ! ${path.basename(videoLocal)} is ${Math.round(p.sec)}s — Reels over 3 min may be refused`)
  }

  const caption = item.caption.trim()
  const slop = slopCheck(caption)
  if (slop && !FORCE) throw new Error(`caption failed the slop check (rewrite, or --force):\n${slop}`)

  const bucket = BUCKETS[brand]
  if (!bucket) throw new Error(`no public bucket for brand "${brand}" — add it to BUCKETS`)
  const when = at.toISOString()
  if (DRY) {
    console.log(`  ~ ${source} → ${channels.join('+')} @ ${when} (dry run, nothing uploaded)`)
    return { at: at.getTime(), dry: true }
  }

  const videoUrl = videoLocal ? await upload(bucket, videoLocal, `videos/${name}.mp4`, 'video/mp4') : item.video
  let coverUrl = null
  if (item.cover) {
    const coverLocal = isUrl(item.cover) ? null : path.resolve(baseDir, item.cover)
    coverUrl = coverLocal
      ? await upload(bucket, coverLocal, `videos/${name}${path.extname(coverLocal) || '.jpg'}`, coverLocal.endsWith('.png') ? 'image/png' : 'image/jpeg')
      : item.cover
  }

  if (channels.includes('tiktok')) {
    const seq = (await rest('GET', `buffer_feed?clinic_id=eq.${clinic.id}&select=seq&order=seq.desc&limit=1`))[0]?.seq ?? 0
    await rest(
      'POST',
      'buffer_feed',
      {
        clinic_id: clinic.id,
        seq: seq + 1,
        source,
        caption,
        channels: ['tiktok'],
        video_url: videoUrl,
        cover_url: coverUrl,
        ai_generated: Boolean(item.ai),
        due_at: when,
      },
      { Prefer: 'return=minimal' },
    )
  }
  if (channels.includes('instagram')) {
    await rest(
      'POST',
      'meta_posts',
      { clinic_id: clinic.id, network: 'instagram', caption, video_url: videoUrl, cover_url: coverUrl, publish_at: when, source },
      { Prefer: 'return=minimal' },
    )
  }
  q.feed.push({ source, channels: ['tiktok'], due_at: when, video_url: videoUrl })
  console.log(`  + ${source} → ${channels.join('+')} @ ${when}`)
  return { at: at.getTime() }
}

// ── commands ─────────────────────────────────────────────────────────────────

const CAPTION_FILES = ['.caption.txt', '.caption.md', '.txt', '.md']
const COVER_FILES = ['.cover.jpg', '.jpg', '.jpeg', '.cover.png', '.png']

function notify(title, text) {
  if (!flag('notify')) return
  try {
    execFileSync('osascript', ['-e', `display notification ${JSON.stringify(text)} with title ${JSON.stringify(title)}`])
  } catch {
    /* no GUI session — the log has it */
  }
}

async function drop() {
  const dir = path.resolve(argv[1] ?? die('drop <folder>'))
  const brand = opt('brand') ?? die('--brand required')
  const every = Number(opt('every', '2'))
  const hour = Number(opt('hour', '16'))
  const channels = opt('channels', 'tiktok,instagram').split(',')
  if (!fs.existsSync(dir)) die(`no such folder: ${dir}`)

  const videos = fs
    .readdirSync(dir)
    .filter((f) => /\.(mp4|mov)$/i.test(f) && !f.startsWith('.'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  if (!videos.length) return console.log('nothing to do — no videos in', dir)

  const clinic = await clinicFor(brand)
  const q = await queued(clinic.id)
  const cal = calendar(q)
  const done = []
  const waiting = []
  const failed = []

  for (const file of videos) {
    const base = file.replace(/\.(mp4|mov)$/i, '')
    const full = path.join(dir, file)
    const capFile = CAPTION_FILES.map((e) => path.join(dir, base + e)).find((f) => fs.existsSync(f))
    if (!capFile) {
      waiting.push(`${file} (no caption yet)`)
      continue
    }
    const coverFile = COVER_FILES.map((e) => path.join(dir, base + e)).find((f) => fs.existsSync(f))
    const at = nextSlot(cal, { every, hour, channels })
    try {
      const r = await addOne(
        brand,
        clinic,
        { video: full, caption: fs.readFileSync(capFile, 'utf8'), cover: coverFile, at: new Date(at).toISOString(), channels },
        dir,
        q,
      )
      if (r.dry) {
        cal.lastVideo = at
        if (channels.includes('instagram')) cal.igDays.add(dayKey(at))
        done.push(`${file} → ${dayKey(at)}`)
        continue
      }
      if (!r.skipped) {
        cal.lastVideo = at
        if (channels.includes('instagram')) cal.igDays.add(dayKey(at))
        done.push(`${file} → ${dayKey(at)}`)
      }
      // queued (or already was): move the set out of the inbox
      const dest = path.join(dir, 'queued')
      fs.mkdirSync(dest, { recursive: true })
      for (const f of [full, capFile, coverFile].filter(Boolean)) fs.renameSync(f, path.join(dest, path.basename(f)))
    } catch (e) {
      failed.push(`${file}: ${e.message}`)
      console.error(`  ✗ ${file}: ${e.message}`)
    }
  }

  for (const w of waiting) console.log(`  … ${w}`)
  console.log(`\n${done.length} queued${DRY ? ' (dry run)' : ''}, ${waiting.length} waiting, ${failed.length} failed.`)
  if (done.length) notify('Content Machine', `${done.length} video(s) queued: ${done[0].split(' → ')[1]} … ${done.at(-1).split(' → ')[1]}`)
  if (failed.length) notify('Content Machine — video not queued', failed[0].slice(0, 180))
  if (failed.length) process.exit(1)
}

/** BUFFER_ACCESS_TOKEN_<BRAND> from the environment or .env.local; null if absent. */
function bufferToken(brand) {
  const name = `BUFFER_ACCESS_TOKEN_${brand.toUpperCase()}`
  if (process.env[name]) return process.env[name]
  try {
    const env = fs.readFileSync(fileURLToPath(new URL('../.env.local', import.meta.url)), 'utf8')
    return env.match(new RegExp(`^${name}=["']?([^"'\\n]+)`, 'm'))?.[1] ?? null
  } catch {
    return null
  }
}

/**
 * buffer_feed keeps `scheduled` after a post goes out — only Buffer knows it
 * was sent. Ask Buffer per post: { status: sent|scheduled|error…, link, error }.
 */
async function bufferStatus(token, ids) {
  const out = {}
  for (const id of ids) {
    try {
      const res = await fetch('https://api.buffer.com/graphql', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'query($id: PostId!){ post(input:{id:$id}) { status sentAt externalLink error { message } } }',
          variables: { id },
        }),
      })
      const j = await res.json()
      const p = j.data?.post
      out[id] = p
        ? { status: p.status, link: p.externalLink, error: p.error?.message }
        : { status: '?', error: j.errors?.map((e) => e.message).join('; ') ?? `HTTP ${res.status}` }
    } catch (e) {
      out[id] = { status: '?', error: e.message }
    }
  }
  return out
}

async function list() {
  const brand = opt('brand') ?? die('--brand required')
  const clinic = await clinicFor(brand)
  const { feed, meta } = await queued(clinic.id)
  const token = bufferToken(brand)
  const tiktokIds = feed.filter((f) => f.video_url && f.buffer_ids?.tiktok).map((f) => f.buffer_ids.tiktok)
  const live = token ? await bufferStatus(token, tiktokIds) : {}
  if (!token) console.warn(`  ! no BUFFER_ACCESS_TOKEN_${brand.toUpperCase()} — TikTok status is the table's, not Buffer's`)
  const tiktokRow = (f) => {
    const b = live[f.buffer_ids?.tiktok]
    // pending = still in our table, not handed to Buffer yet
    const s = !f.buffer_ids?.tiktok ? 'pending' : b?.status === 'sent' ? 'published' : (b?.status ?? f.status)
    return { t: f.due_at, ch: 'tiktok (Buffer)', s, src: f.source, err: b?.error ?? f.last_error, link: b?.link }
  }
  const rows = [
    ...feed.filter((f) => f.video_url).map(tiktokRow),
    ...meta.filter((m) => m.video_url).map((m) => ({ t: m.publish_at, ch: 'instagram (Meta)', s: m.status, src: m.source, err: m.last_error, link: m.permalink })),
    ...meta.filter((m) => m.kind === 'story').map((m) => ({ t: m.publish_at, ch: 'ig story (Meta)', s: m.status, src: m.source, err: m.last_error, link: m.permalink })),
  ].sort((a, b) => a.t.localeCompare(b.t))
  for (const r of rows) console.log(`${r.t.slice(0, 16)}  ${r.s.padEnd(10)} ${r.ch.padEnd(17)} ${r.src}${r.link ? `  ${r.link}` : ''}${r.err ? `  ✗ ${r.err}` : ''}`)
  console.log(`${rows.length} video/story row(s)`)
}

/** NN-slug.png/jpg → one Story each, in name order, starting at --start. */
async function stories() {
  const dir = path.resolve(argv[1] ?? die('stories <folder>'))
  const brand = opt('brand') ?? die('--brand required')
  const start = Date.parse(opt('start') ?? die('--start required (ISO, e.g. 2026-10-26T13:00:00Z)'))
  if (Number.isNaN(start)) die(`bad --start "${opt('start')}"`)
  const everyMin = Number(opt('every-min', '60'))
  const name = slug(opt('name', path.basename(dir)))
  const [lo, hi] = (opt('only') ?? '1-999').split('-').map(Number)
  const bucket = BUCKETS[brand] ?? die(`no public bucket for brand "${brand}" — add it to BUCKETS`)
  if (!fs.existsSync(dir)) die(`no such folder: ${dir}`)

  const files = fs
    .readdirSync(dir)
    .filter((f) => /\.(png|jpe?g)$/i.test(f) && !f.startsWith('.'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  if (!files.length) die(`no png/jpg in ${dir}`)

  const clinic = await clinicFor(brand)
  const q = await queued(clinic.id)
  const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR ?? '/tmp', 'stories-'))
  let added = 0
  for (const [i, file] of files.entries()) {
    const n = i + 1
    if (n < lo || n > (hi || lo)) continue
    const base = slug(file.replace(/\.(png|jpe?g)$/i, ''))
    const source = `story:${name}-${base}`
    const at = new Date(start + (n - lo) * everyMin * 60_000).toISOString()
    if (q.meta.some((m) => m.source === source)) {
      console.log(`  = ${source} already queued — skipped`)
      continue
    }
    if (DRY) {
      console.log(`  ~ ${source} @ ${at} (dry run, nothing uploaded)`)
      continue
    }
    let jpg = path.join(dir, file)
    if (/\.png$/i.test(file)) {
      jpg = path.join(tmp, `${base}.jpg`)
      execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '95', path.join(dir, file), '--out', jpg], { stdio: 'ignore' })
    }
    const url = await upload(bucket, jpg, `stories/${name}/${base}.jpg`, 'image/jpeg')
    await rest(
      'POST',
      'meta_posts',
      { clinic_id: clinic.id, network: 'instagram', kind: 'story', caption: '', image_urls: [url], publish_at: at, source },
      { Prefer: 'return=minimal' },
    )
    added++
    console.log(`  + ${source} @ ${at}  ${url}`)
  }
  fs.rmSync(tmp, { recursive: true, force: true })
  console.log(`\n${added} stor${added === 1 ? 'y' : 'ies'} queued${DRY ? ' (dry run)' : ''}.`)
}

async function addOrPlan() {
  let brand, items, baseDir
  if (cmd === 'add') {
    brand = opt('brand') ?? die('--brand required')
    let caption = opt('caption')
    if (caption?.startsWith('@')) caption = fs.readFileSync(caption.slice(1), 'utf8')
    items = [{ video: opt('video'), cover: opt('cover'), caption, at: opt('at'), channels: opt('channels')?.split(','), ai: flag('ai'), source: opt('source') }]
    baseDir = process.cwd()
  } else {
    const file = argv[1] ?? die('plan <file.json>')
    const plan = JSON.parse(fs.readFileSync(file, 'utf8'))
    brand = opt('brand') ?? plan.brand ?? die('--brand required (or "brand" in the json)')
    items = Array.isArray(plan) ? plan : plan.items
    baseDir = path.dirname(path.resolve(file))
  }
  const clinic = await clinicFor(brand)
  const q = await queued(clinic.id)
  let added = 0
  let failed = 0
  for (const item of items) {
    try {
      const r = await addOne(brand, clinic, item, baseDir, q)
      if (!r.skipped && !r.dry) added++
    } catch (e) {
      failed++
      console.error(`  ✗ ${item.source ?? item.video}: ${e.message}`)
    }
  }
  console.log(`\n${added} queued, ${failed} failed${DRY ? ' (dry run)' : ''}.`)
  if (failed) process.exit(1)
}

const COMMANDS = { drop, list, stories, add: addOrPlan, plan: addOrPlan }
if (!COMMANDS[cmd]) die('usage: feed-video.mjs drop|add|plan|list|stories … (see the header)')
COMMANDS[cmd]().catch((e) => die(e.message))
