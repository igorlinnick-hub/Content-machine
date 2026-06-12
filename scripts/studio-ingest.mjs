// Push a reference reel into the Studio base (studio_videos) directly:
// download via yt-dlp, upload mp4 + thumbnail to the arsenal-videos
// bucket, derive a light structure, insert the row. Bypasses the app —
// uses the Supabase service key from .env.local.
//
//   node scripts/studio-ingest.mjs "<instagram/tiktok url>"
//   node scripts/studio-ingest.mjs "<url>" --file /tmp/reel.mp4   # reuse a download
//
// Optional env: CLINIC_ID (defaults to the first clinic).
//
// Structure/style for a new URL are auto-stubbed; for a richer card,
// pass --style "..." and the beats are inferred from the caption. The
// idea Writer adapts whatever it gets to the clinic's niche.

import { readFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const BUCKET = 'arsenal-videos'

function loadEnv() {
  const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  const env = {}
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}

function arg(flag) {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : null
}

async function main() {
  const url = process.argv[2]
  if (!url || url.startsWith('--')) {
    console.error('usage: node scripts/studio-ingest.mjs "<url>" [--file path] [--style "..."]')
    process.exit(1)
  }
  const env = loadEnv()
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) throw new Error('missing Supabase env in .env.local')
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  // 1. clinic
  let clinicId = env.CLINIC_ID || process.env.CLINIC_ID
  if (!clinicId) {
    const { data } = await supabase.from('clinics').select('id, name').limit(1).single()
    if (!data) throw new Error('no clinic found')
    clinicId = data.id
    console.log(`clinic: ${data.name} (${clinicId})`)
  }

  // 2. download (or reuse)
  const id = randomUUID()
  const mp4 = arg('--file') || `/tmp/studio_${id}.mp4`
  if (!arg('--file')) {
    console.log('downloading via yt-dlp…')
    execFileSync('yt-dlp', ['-q', '-f', 'best[ext=mp4]/best', '-o', mp4, url], {
      stdio: 'inherit',
    })
  }
  if (!existsSync(mp4)) throw new Error(`video file not found: ${mp4}`)

  // 3. metadata (uploader / view_count / caption)
  let uploader = '', viewCount = null, caption = ''
  try {
    const out = execFileSync(
      'yt-dlp',
      ['--skip-download', '--print', '%(uploader)s\t%(view_count)s\t%(description)s', url],
      { encoding: 'utf8' }
    ).trim()
    const [u, v, ...rest] = out.split('\t')
    uploader = u && u !== 'NA' ? u : ''
    viewCount = v && v !== 'NA' ? Number.parseInt(v, 10) : null
    caption = rest.join('\t')
  } catch {
    /* metadata is best-effort */
  }
  const handle = uploader ? `@${uploader.replace(/\s+/g, '').toLowerCase()}` : null

  // 4. thumbnail (first clean frame)
  const thumb = `/tmp/studio_${id}.jpg`
  try {
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', mp4, '-ss', '1', '-frames:v', '1', thumb])
  } catch {
    /* thumbnail optional */
  }

  // 5. upload to bucket
  const videoPath = `studio/${clinicId}/${id}.mp4`
  const thumbPath = `studio/${clinicId}/${id}.jpg`
  console.log('uploading mp4…')
  {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(videoPath, readFileSync(mp4), { contentType: 'video/mp4', upsert: true })
    if (error) throw new Error(`mp4 upload failed: ${error.message}`)
  }
  if (existsSync(thumb)) {
    await supabase.storage
      .from(BUCKET)
      .upload(thumbPath, readFileSync(thumb), { contentType: 'image/jpeg', upsert: true })
  }

  // 6. structure / style (light — Writer adapts it to the clinic)
  const style =
    arg('--style') ||
    'Fast "this vs that" comparison: a talking-head names two options on screen, picks one with a one-line reason, repeats for several rounds, ends with the overall pick.'
  const structure = {
    beats: [
      { name: 'hook', text: 'Pose the question — "what\'s better for X?"' },
      { name: 'rounds', text: 'Name two options on screen (A vs B), pick one + a one-line reason. Repeat 3-4 times.' },
      { name: 'close', text: 'State the overall winner.' },
    ],
  }

  // 7. insert row
  const { data, error } = await supabase
    .from('studio_videos')
    .insert({
      clinic_id: clinicId,
      source_url: url,
      source_platform: url.includes('tiktok') ? 'tiktok' : url.includes('youtu') ? 'youtube' : 'instagram',
      author_handle: handle,
      view_count: viewCount,
      title: caption ? caption.split('\n')[0].slice(0, 120) : 'Reference reel',
      style_description: style,
      structure,
      caption: caption || null,
      video_storage_path: videoPath,
      thumbnail_storage_path: existsSync(thumb) ? thumbPath : null,
      is_active: true,
    })
    .select('id')
    .single()
  if (error) throw new Error(`insert failed: ${error.message}`)

  console.log(`✓ added to Studio base: ${data.id}`)
  console.log(`  account: ${handle ?? 'n/a'} · views: ${viewCount ?? 'n/a'}`)
  console.log('  Open /studio — it will seed a column from this on next load.')
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
