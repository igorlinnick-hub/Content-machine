#!/usr/bin/env node
// Queue finished videos for TikTok / Instagram Reels through the Buffer feeder.
// Uploads the mp4 (and cover) to the brand's public bucket, then adds a
// buffer_feed row; /api/cron/buffer-feed hands it to Buffer once a slot is free
// (free plan: 10 scheduled per channel). Contract: docs/VIDEO-FEED.md.
//
//   node scripts/feed-video.mjs add --brand hiredrop --video reel.mp4 \
//        --caption "text…" --at 2026-10-12T16:00:00Z [--channels tiktok,instagram]
//        [--cover cover.jpg] [--ai] [--source my-id] [--dry]
//   node scripts/feed-video.mjs plan month.json [--dry]   # many at once
//   node scripts/feed-video.mjs list --brand hiredrop
//
// month.json = [{ video, caption, at, channels?, cover?, ai?, source? }, …];
// relative paths resolve against the json's folder. --video/--cover take a
// local file or an https URL that is already public.
//
// The caption goes through the slop check (scripts/slop-check.mjs); hits stop
// the row unless --force. Re-running is safe: (brand, source) is unique and an
// existing source is skipped.
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const PROJECT_REF = 'pscqjvkuqqmvmcbxdwtu'
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`
// Public bucket per brand. A brand missing here can't take videos yet.
const BUCKETS = { hiredrop: 'hiredrop-posts' }
const CHANNELS = ['tiktok', 'instagram', 'threads']

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
    return { w: j.streams?.[0]?.width, h: j.streams?.[0]?.height, sec: Number(j.format?.duration) }
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

async function addOne(brand, clinic, item, baseDir, nextSeq) {
  const channels = (item.channels ?? ['tiktok']).map((c) => c.trim()).filter(Boolean)
  const bad = channels.filter((c) => !CHANNELS.includes(c))
  if (bad.length) throw new Error(`unknown channel(s): ${bad.join(', ')}`)
  if (!item.video) throw new Error('video required')
  if (!item.caption?.trim()) throw new Error('caption required')
  const at = new Date(item.at)
  if (!item.at || Number.isNaN(at.getTime())) throw new Error(`bad --at "${item.at}" (ISO, e.g. 2026-10-12T16:00:00Z)`)
  if (at.getTime() < Date.now() + 60 * 60_000) console.warn(`  ! ${item.at} is less than 1h away — the feeder will move it to the next free time`)

  const isUrl = (s) => /^https?:\/\//.test(s)
  const videoLocal = isUrl(item.video) ? null : path.resolve(baseDir, item.video)
  if (videoLocal && !fs.existsSync(videoLocal)) throw new Error(`no such file: ${videoLocal}`)
  const source = `video:${item.source ?? slug(path.basename(item.video, path.extname(item.video)))}`

  const exists = await rest('GET', `buffer_feed?clinic_id=eq.${clinic.id}&source=eq.${encodeURIComponent(source)}&select=id,status`)
  if (exists.length) {
    console.log(`  = ${source} already queued (${exists[0].status}) — skipped`)
    return false
  }

  if (videoLocal) {
    const p = probe(videoLocal)
    if (p?.w && p?.h && Math.abs(p.w / p.h - 9 / 16) > 0.02) console.warn(`  ! ${path.basename(videoLocal)} is ${p.w}×${p.h}, not 9:16`)
    if (p?.sec && p.sec < 3) throw new Error(`${path.basename(videoLocal)} is ${p.sec.toFixed(1)}s — TikTok wants at least 3s`)
  }

  const slop = slopCheck(item.caption)
  if (slop && !FORCE) throw new Error(`caption failed the slop check (rewrite, or --force):\n${slop}`)

  const bucket = BUCKETS[brand]
  if (!bucket) throw new Error(`no public bucket for brand "${brand}" — add it to BUCKETS`)
  const name = source.slice('video:'.length)
  if (DRY) {
    console.log(`  ~ ${source} → ${channels.join('+')} @ ${at.toISOString()} (dry run, nothing uploaded)`)
    return false
  }
  const videoUrl = videoLocal ? await upload(bucket, videoLocal, `videos/${name}.mp4`, 'video/mp4') : item.video
  let coverUrl = null
  if (item.cover) {
    const coverLocal = isUrl(item.cover) ? null : path.resolve(baseDir, item.cover)
    coverUrl = coverLocal
      ? await upload(bucket, coverLocal, `videos/${name}${path.extname(coverLocal) || '.jpg'}`, coverLocal.endsWith('.png') ? 'image/png' : 'image/jpeg')
      : item.cover
  }

  await rest(
    'POST',
    'buffer_feed',
    {
      clinic_id: clinic.id,
      seq: nextSeq,
      source,
      caption: item.caption.trim(),
      channels,
      video_url: videoUrl,
      cover_url: coverUrl,
      ai_generated: Boolean(item.ai),
      due_at: at.toISOString(),
    },
    { Prefer: 'return=minimal' },
  )
  console.log(`  + ${source} → ${channels.join('+')} @ ${at.toISOString()}`)
  return true
}

async function maxSeq(clinicId) {
  const r = await rest('GET', `buffer_feed?clinic_id=eq.${clinicId}&select=seq&order=seq.desc&limit=1`)
  return r[0]?.seq ?? 0
}

async function main() {
  if (cmd === 'list') {
    const brand = opt('brand') ?? die('--brand required')
    const clinic = await clinicFor(brand)
    const rows = await rest(
      'GET',
      `buffer_feed?clinic_id=eq.${clinic.id}&video_url=not.is.null&select=source,channels,due_at,status,last_error&order=due_at`,
    )
    for (const r of rows) console.log(`${r.due_at}  ${r.status.padEnd(9)} ${r.channels.join('+').padEnd(16)} ${r.source}${r.last_error ? `  ✗ ${r.last_error}` : ''}`)
    console.log(`${rows.length} video row(s)`)
    return
  }

  let brand, items, baseDir
  if (cmd === 'add') {
    brand = opt('brand') ?? die('--brand required')
    let caption = opt('caption')
    if (caption?.startsWith('@')) caption = fs.readFileSync(caption.slice(1), 'utf8')
    items = [{
      video: opt('video'),
      cover: opt('cover'),
      caption,
      at: opt('at'),
      channels: opt('channels')?.split(','),
      ai: flag('ai'),
      source: opt('source'),
    }]
    baseDir = process.cwd()
  } else if (cmd === 'plan') {
    const file = argv[1] ?? die('plan <file.json>')
    const plan = JSON.parse(fs.readFileSync(file, 'utf8'))
    brand = opt('brand') ?? plan.brand ?? die('--brand required (or "brand" in the json)')
    items = Array.isArray(plan) ? plan : plan.items
    baseDir = path.dirname(path.resolve(file))
  } else {
    die('usage: feed-video.mjs add|plan|list … (see the header)')
  }

  const clinic = await clinicFor(brand)
  let seq = await maxSeq(clinic.id)
  let added = 0
  let failed = 0
  for (const item of items) {
    try {
      if (await addOne(brand, clinic, item, baseDir, seq + 1)) {
        seq++
        added++
      }
    } catch (e) {
      failed++
      console.error(`  ✗ ${item.source ?? item.video}: ${e.message}`)
    }
  }
  console.log(`\n${added} queued, ${failed} failed${DRY ? ' (dry run)' : ''}. The feeder picks them up at 16:30 UTC daily.`)
  if (failed) process.exit(1)
}

main().catch((e) => die(e.message))
