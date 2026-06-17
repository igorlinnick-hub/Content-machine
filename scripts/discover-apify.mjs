// Discovery via Apify (TikTok — vertical, native, fresh): run the TikTok
// scraper for the clinic's niche queries, take the top viral verticals,
// download the mp4 (from Apify's media store), upload to our bucket, and
// insert as status='candidate' so they appear in Studio → Discover.
//
//   node scripts/discover-apify.mjs            (default: min 25000 plays, take 5)
//   node scripts/discover-apify.mjs --min 50000 --take 6
//
// Uses APIFY_TOKEN + Supabase service key from .env.local.

import { readFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const BUCKET = 'arsenal-videos'
const ACTOR = 'clockworks~tiktok-scraper'

// FORMAT-first queries — we want repeatable, simple talking-head FORMATS a
// clinic can re-film (this-vs-that, myth-vs-fact, "what I tell my patients",
// doctor-reacts), not random clinical topics. "doctor" keeps it in-niche.
const QUERIES = [
  'doctor this or that',
  'doctor myth vs fact',
  'what I tell my patients doctor',
  'doctor reacts health',
  'biggest mistake doctor health',
]

function arg(flag, dflt) {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : dflt
}
const MIN = parseInt(arg('--min', '25000'), 10)
const TAKE = parseInt(arg('--take', '5'), 10)

function loadEnv() {
  const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  const env = {}
  for (const l of raw.split('\n')) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}

async function main() {
  const env = loadEnv()
  const TOK = env.APIFY_TOKEN
  if (!TOK) throw new Error('APIFY_TOKEN missing in .env.local')
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
  const { data: clinic } = await sb.from('clinics').select('id,name').limit(1).single()
  if (!clinic) throw new Error('no clinic found')
  console.log(`clinic: ${clinic.name}`)

  // 1. run the Apify TikTok scraper (downloads the mp4s on Apify's side)
  console.log(`running Apify ${ACTOR} for ${QUERIES.length} queries…`)
  const res = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${TOK}&timeout=240`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchQueries: QUERIES,
        resultsPerPage: 6,
        shouldDownloadVideos: true,
        shouldDownloadCovers: true,
      }),
    }
  )
  const items = await res.json()
  if (!Array.isArray(items)) throw new Error(`apify: ${JSON.stringify(items).slice(0, 200)}`)
  console.log(`got ${items.length} items`)

  // 2. dedup + filter by plays + sort by reach
  const seen = new Set()
  let pool = []
  for (const v of items) {
    const url = v.webVideoUrl
    if (!url || seen.has(url)) continue
    seen.add(url)
    const plays = v.playCount ?? v.diggCount ?? 0
    if (plays < MIN) continue
    // English only — skip Thai/Burmese/etc so candidates are usable.
    const lang = v.textLanguage || ''
    if (lang && lang !== 'en') continue
    const mp4 = (v.mediaUrls && v.mediaUrls[0]) || v.videoMeta?.downloadAddr
    if (!mp4) continue
    pool.push({
      url,
      plays,
      author: v.authorMeta?.name || null,
      caption: v.text || '',
      cover: v.videoMeta?.coverUrl || (v.covers && v.covers[0]) || null,
      mp4,
    })
  }
  pool.sort((a, b) => b.plays - a.plays)
  console.log(`\n${pool.length} candidates >= ${MIN} plays. Taking top ${TAKE}.\n`)

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
      const mp4path = `/tmp/ap_${id}.mp4`
      console.log(`↓ ${v.plays.toLocaleString()} plays — @${v.author} — ${v.caption.slice(0, 40)}`)
      // fetch the mp4 Apify stored (its KV store is private → needs the token)
      const mp4url = v.mp4.includes('api.apify.com')
        ? `${v.mp4}${v.mp4.includes('?') ? '&' : '?'}token=${TOK}`
        : v.mp4
      const vr = await fetch(mp4url)
      if (!vr.ok) throw new Error(`mp4 fetch ${vr.status}`)
      const buf = Buffer.from(await vr.arrayBuffer())
      if (buf.length < 10000) throw new Error('mp4 too small')
      const { writeFileSync } = await import('node:fs')
      writeFileSync(mp4path, buf)
      // thumbnail
      const thumb = `/tmp/ap_${id}.jpg`
      try {
        execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', mp4path, '-ss', '1', '-frames:v', '1', thumb])
      } catch {
        /* optional */
      }
      const videoPath = `studio/${clinic.id}/${id}.mp4`
      const thumbPath = `studio/${clinic.id}/${id}.jpg`
      {
        const { error } = await sb.storage
          .from(BUCKET)
          .upload(videoPath, buf, { contentType: 'video/mp4', upsert: true })
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
        source_platform: 'tiktok',
        author_handle: v.author ? `@${v.author}` : null,
        view_count: v.plays,
        title: v.caption.slice(0, 120) || 'TikTok reel',
        style_description:
          'Vertical talking-head doctor reel — sharp hook, plain-English myth-bust or this-vs-that, one takeaway. Re-film inside the clinic.',
        structure: {
          beats: [
            { name: 'hook', text: 'Open with a question / myth in the first 2s.' },
            { name: 'point', text: 'Bust it / compare options in plain English.' },
            { name: 'cta', text: 'One clear takeaway.' },
          ],
        },
        caption: v.caption,
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

  console.log(`\n✓ added ${added} TikTok candidates to Discover.`)
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
