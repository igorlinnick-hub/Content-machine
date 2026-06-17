import { createServerClient } from '@/lib/supabase/server'
import { randomUUID } from 'crypto'
import type { StudioStatus, StudioVideo } from '@/lib/studio/videos'

const BUCKET = 'arsenal-videos'
const TIKTOK_ACTOR = 'clockworks~tiktok-scraper'

function detectPlatform(url: string): 'tiktok' | 'instagram' | 'youtube' | null {
  if (/tiktok\.com/i.test(url)) return 'tiktok'
  if (/instagram\.com/i.test(url)) return 'instagram'
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube'
  return null
}

const DEFAULT_STRUCTURE = {
  beats: [
    { name: 'hook', text: 'Open with a question / myth in the first 2s.' },
    { name: 'point', text: 'Bust it / compare options in plain English.' },
    { name: 'cta', text: 'One clear takeaway.' },
  ],
}

// Admin "Add to Shot List": ingest a single TikTok video by URL via Apify
// (Apify runs the scrape on its own infra, so this works on Vercel — no
// local worker), copy the mp4 into our bucket, and insert a studio_videos
// row at the given status. Returns the new row id.
export async function addStudioVideoByUrl(params: {
  clinicId: string
  url: string
  status: StudioStatus
}): Promise<{ id: string }> {
  const token = process.env.APIFY_TOKEN
  if (!token) throw new Error('APIFY_TOKEN not configured on the server')

  const platform = detectPlatform(params.url)
  if (platform !== 'tiktok') {
    throw new Error(
      platform === 'instagram'
        ? 'Instagram links are not supported yet — paste a TikTok link or upload the file.'
        : 'Paste a TikTok video link.'
    )
  }

  // 1. scrape the single video (Apify downloads the mp4 to its KV store)
  const res = await fetch(
    `https://api.apify.com/v2/acts/${TIKTOK_ACTOR}/run-sync-get-dataset-items?token=${token}&timeout=180`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postURLs: [params.url],
        resultsPerPage: 1,
        shouldDownloadVideos: true,
        shouldDownloadCovers: false,
      }),
    }
  )
  const items = (await res.json()) as unknown
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Apify returned no video for that link')
  }
  const v = items[0] as Record<string, unknown>
  const videoMeta = (v.videoMeta as Record<string, unknown>) || {}
  const authorMeta = (v.authorMeta as Record<string, unknown>) || {}
  const mediaUrls = (v.mediaUrls as string[]) || []
  const mp4 = mediaUrls[0] || (videoMeta.downloadAddr as string)
  if (!mp4) throw new Error('No downloadable video found for that link')

  // 2. fetch the mp4 (Apify KV is private → append the token)
  const mp4url = mp4.includes('api.apify.com')
    ? `${mp4}${mp4.includes('?') ? '&' : '?'}token=${token}`
    : mp4
  const vr = await fetch(mp4url)
  if (!vr.ok) throw new Error(`video download failed (${vr.status})`)
  const buf = Buffer.from(await vr.arrayBuffer())
  if (buf.length < 10000) throw new Error('downloaded video looks empty')

  // 3. upload to our bucket
  const supabase = createServerClient()
  const id = randomUUID()
  const videoPath = `studio/${params.clinicId}/${id}.mp4`
  const up = await supabase.storage
    .from(BUCKET)
    .upload(videoPath, buf, { contentType: 'video/mp4', upsert: true })
  if (up.error) throw new Error(`upload failed: ${up.error.message}`)

  // 4. insert the row
  const caption = (v.text as string) || ''
  const author = (authorMeta.name as string) || null
  const plays = (v.playCount as number) ?? (v.diggCount as number) ?? null
  const { data, error } = await supabase
    .from('studio_videos')
    .insert({
      clinic_id: params.clinicId,
      source_url: (v.webVideoUrl as string) || params.url,
      source_platform: 'tiktok',
      author_handle: author ? `@${author}` : null,
      view_count: plays,
      title: caption.slice(0, 120) || 'TikTok reel',
      style_description:
        'Vertical talking-head doctor reel — sharp hook, plain-English point, one takeaway. Re-film inside the clinic.',
      structure: DEFAULT_STRUCTURE as unknown as never,
      caption: caption || null,
      video_storage_path: videoPath,
      thumbnail_storage_path: null,
      is_active: true,
      status: params.status,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`insert failed: ${error?.message ?? 'unknown'}`)
  return { id: data.id }
}

export type { StudioVideo }
