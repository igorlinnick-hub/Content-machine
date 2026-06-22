// FREE discovery via YouTube + yt-dlp: search the clinic's niche keywords,
// take the top viral Shorts/videos, download + upload + insert them into
// studio_videos as status='candidate' so they show up in Studio → Discover.
//
//   node scripts/discover-youtube.mjs
//   node scripts/discover-youtube.mjs --min 25000 --take 6
//
// No paid service, no API key — yt-dlp + YouTube search is free and stable
// (unlike TikTok/IG scraping). Uses the Supabase service key from .env.local.

import { readFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const BUCKET = 'arsenal-videos'

// The clinic's discovery queries (the keywords we agreed on).
const QUERIES = [
  'doctor health myth busting',
  'longevity doctor tips',
  'PRP joint pain doctor',
  'anti aging medical advice',
  'cortisone shot alternative doctor',
  'stem cell therapy explained doctor',
  'chronic pain recovery doctor',
]

function arg(flag, dflt) {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : dflt
}
const MIN_VIEWS = parseInt(arg('--min', '25000'), 10)
const TAKE = parseInt(arg('--take', '6'), 10)

function loadEnv() {
  const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  const env = {}
  for (const l of raw.split('\n')) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}

function searchYouTube(query, n = 15) {
  // Fast metadata-only listing: id, views, title, uploader.
  let out = ''
  try {
    out = execFileSync(
      'yt-dlp',
      [
        '--flat-playlist',
        '--no-warnings',
        '--socket-timeout',
        '20',
        '--print',
        '%(id)s\t%(view_count)s\t%(duration)s\t%(title)s\t%(uploader)s',
        `ytsearch${n}:${query}`,
      ],
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
    )
  } catch (e) {
    console.warn(`  search failed for "${query}": ${e.message?.slice(0, 80)}`)
    return []
  }
  return out
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [id, views, duration, title, uploader] = line.split('\t')
      return {
        id,
        url: `https://www.youtube.com/watch?v=${id}`,
        view_count: views && views !== 'NA' ? parseInt(views, 10) : null,
        duration: duration && duration !== 'NA' ? parseInt(duration, 10) : null,
        title: title || 'Untitled',
        uploader: uploader || null,
      }
    })
}

async function main() {
  const env = loadEnv()
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
  const { data: clinic } = await sb.from('clinics').select('id,name').limit(1).single()
  if (!clinic) throw new Error('no clinic found')
  console.log(`clinic: ${clinic.name} (${clinic.id})`)

  // 1. gather + dedup candidates across all queries
  const seen = new Set()
  let pool = []
  for (const q of QUERIES) {
    console.log(`searching: ${q}`)
    for (const v of searchYouTube(q)) {
      if (seen.has(v.id)) continue
      seen.add(v.id)
      pool.push(v)
    }
  }
  // 2. filter by views + SHORT-FORM only (10-180s, reels/shorts length —
  //    skip long videos: wrong format + huge/slow downloads) + sort by reach
  pool = pool
    .filter((v) => (v.view_count ?? 0) >= MIN_VIEWS)
    .filter((v) => v.duration != null && v.duration >= 10 && v.duration <= 180)
    .sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))
  console.log(`\n${pool.length} short-form candidates >= ${MIN_VIEWS} views. Taking top ${TAKE}.\n`)

  // 3. skip URLs already in the base
  const { data: existing } = await sb
    .from('studio_videos')
    .select('source_url')
    .eq('clinic_id', clinic.id)
  const have = new Set((existing ?? []).map((r) => r.source_url))

  let added = 0
  for (const v of pool) {
    if (added >= TAKE) break
    if (have.has(v.url)) continue
    try {
      const id = randomUUID()
      const mp4 = `/tmp/disc_${id}.mp4`
      const thumb = `/tmp/disc_${id}.jpg`
      console.log(`↓ ${v.view_count?.toLocaleString()} views — ${v.title.slice(0, 50)}`)
      execFileSync(
        'yt-dlp',
        ['-q', '--max-filesize', '60M', '-f', 'best[ext=mp4][height<=720]/best[ext=mp4]/best', '-o', mp4, v.url],
        { stdio: 'ignore' }
      )
      if (!existsSync(mp4)) throw new Error('download produced no file')
      try {
        execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', mp4, '-ss', '1', '-frames:v', '1', thumb])
      } catch {
        /* thumbnail optional */
      }
      const videoPath = `studio/${clinic.id}/${id}.mp4`
      const thumbPath = `studio/${clinic.id}/${id}.jpg`
      {
        const { error } = await sb.storage
          .from(BUCKET)
          .upload(videoPath, readFileSync(mp4), { contentType: 'video/mp4', upsert: true })
        if (error) throw new Error(`upload: ${error.message}`)
      }
      if (existsSync(thumb)) {
        await sb.storage
          .from(BUCKET)
          .upload(thumbPath, readFileSync(thumb), { contentType: 'image/jpeg', upsert: true })
      }
      const { error } = await sb.from('studio_videos').insert({
        clinic_id: clinic.id,
        source_url: v.url,
        source_platform: 'youtube',
        author_handle: v.uploader ? `@${v.uploader.replace(/\s+/g, '').toLowerCase()}` : null,
        view_count: v.view_count,
        title: v.title.slice(0, 120),
        style_description:
          'Talking-head doctor format — strong hook, plain-English explanation, one clear takeaway. Re-film inside the clinic.',
        structure: {
          beats: [
            { name: 'hook', text: 'Open with a sharp question or myth.' },
            { name: 'point', text: 'Explain the real mechanism in plain English.' },
            { name: 'cta', text: 'One clear takeaway / next step.' },
          ],
        },
        caption: v.title,
        video_storage_path: videoPath,
        thumbnail_storage_path: existsSync(thumb) ? thumbPath : null,
        is_active: true,
        status: 'candidate',
      })
      if (error) throw new Error(`insert: ${error.message}`)
      added++
    } catch (e) {
      console.warn(`  skip — ${e.message?.slice(0, 80)}`)
    }
  }

  console.log(`\n✓ added ${added} candidates to Discover. Open /studio → Discover.`)
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
