import { resolveAccess } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'
export const maxDuration = 180

const ACTOR = 'clockworks~tiktok-scraper'
const BUCKET = 'arsenal-videos'
const QUERIES = [
  'doctor this or that health',
  'doctor myth vs fact medical',
  'what I tell my patients health',
]

export async function POST(req: Request) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { clinicId?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const clinicId = body.clinicId?.trim()
  if (!clinicId) return Response.json({ error: 'clinicId required' }, { status: 400 })

  const token = process.env.APIFY_TOKEN
  if (!token) return Response.json({ error: 'APIFY_TOKEN not configured' }, { status: 500 })

  const supabase = createServerClient()

  // 1. Run Apify TikTok scraper (no video downloads — metadata + covers only)
  const apifyRes = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${token}&timeout=120`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchQueries: QUERIES,
        resultsPerPage: 5,
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
      }),
    }
  )

  if (!apifyRes.ok) {
    const text = await apifyRes.text().catch(() => '')
    return Response.json({ error: `Apify error: ${text.slice(0, 200)}` }, { status: 502 })
  }

  const items: unknown[] = await apifyRes.json()
  if (!Array.isArray(items)) {
    return Response.json({ error: 'Unexpected Apify response' }, { status: 502 })
  }

  // 2. Dedup against existing studio_videos
  const { data: existing } = await supabase
    .from('studio_videos')
    .select('source_url')
    .eq('clinic_id', clinicId)
  const have = new Set(
    (existing ?? [])
      .map((r: { source_url: string | null }) => r.source_url)
      .filter(Boolean)
  )

  // 3. Filter: English, 10k+ plays, not already in DB
  const seen = new Set<string>()
  type ApifyItem = Record<string, unknown>
  const pool: { url: string; plays: number; author: string | null; caption: string; coverUrl: string | null }[] = []

  for (const raw of items) {
    const v = raw as ApifyItem
    const url = v.webVideoUrl as string | undefined
    if (!url || seen.has(url) || have.has(url)) continue
    const lang = (v.textLanguage as string) || ''
    if (lang && lang !== 'en') continue
    const plays = (v.playCount as number) ?? 0
    if (plays < 10000) continue
    const meta = v.videoMeta as Record<string, string> | undefined
    const coverUrl = meta?.coverUrl ?? null
    seen.add(url)
    pool.push({
      url,
      plays,
      author: ((v.authorMeta as Record<string, string> | undefined)?.name) ?? null,
      caption: ((v.text as string) || '').slice(0, 120),
      coverUrl,
    })
  }

  pool.sort((a, b) => b.plays - a.plays)

  // 4. Insert top 5 new candidates
  let added = 0
  for (const v of pool.slice(0, 5)) {
    try {
      const id = randomUUID()
      let thumbnailPath: string | null = null

      // Try to upload TikTok cover image if available
      if (v.coverUrl) {
        try {
          const coverRes = await fetch(v.coverUrl)
          if (coverRes.ok) {
            const buf = Buffer.from(await coverRes.arrayBuffer())
            const path = `studio/${clinicId}/${id}.jpg`
            const { error: uploadErr } = await supabase.storage
              .from(BUCKET)
              .upload(path, buf, { contentType: 'image/jpeg', upsert: true })
            if (!uploadErr) thumbnailPath = path
          }
        } catch { /* cover upload optional */ }
      }

      const { error } = await supabase.from('studio_videos').insert({
        id,
        clinic_id: clinicId,
        source_url: v.url,
        source_platform: 'tiktok',
        author_handle: v.author ? `@${v.author}` : null,
        view_count: v.plays,
        title: v.caption || 'TikTok format',
        style_description:
          'Vertical talking-head doctor reel — hook, myth-bust or this-vs-that, one takeaway. Re-film inside the clinic.',
        structure: {
          beats: [
            { name: 'hook', text: 'Open with a question or myth in the first 2s.' },
            { name: 'point', text: 'Bust it or compare options in plain English.' },
            { name: 'cta', text: 'One clear takeaway.' },
          ],
        },
        caption: v.caption,
        thumbnail_storage_path: thumbnailPath,
        video_storage_path: null,
        is_active: true,
        status: 'candidate',
      })
      if (!error) added++
    } catch { /* skip on error */ }
  }

  return Response.json({ ok: true, added })
}
