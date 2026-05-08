import { randomBytes } from 'crypto'
import { createServerClient } from '@/lib/supabase/server'

const BUCKET = 'clinic-videos'

export type VideoStatus = 'pending' | 'generating' | 'rendered' | 'failed'

export interface VideoSet {
  id: string
  clinic_id: string
  script_id: string | null
  prompt: string
  replicate_prediction_id: string | null
  replicate_model: string | null
  storage_path: string | null
  public_url: string | null
  duration_sec: number | null
  aspect_ratio: string | null
  resolution: string | null
  category_id: string | null
  status: VideoStatus
  error: string | null
  created_at: string
}

export interface VideoListItem {
  id: string
  prompt: string
  public_url: string | null
  duration_sec: number | null
  aspect_ratio: string | null
  resolution: string | null
  status: VideoStatus
  created_at: string
  category: { id: string; name: string; emoji: string | null } | null
}

export async function createVideoSet(params: {
  clinicId: string
  scriptId?: string | null
  prompt: string
  duration_sec: number
  aspect_ratio: string
  resolution: string
  categoryId?: string | null
  replicate_model: string
  status?: VideoStatus
}): Promise<{ id: string }> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('video_sets')
    .insert({
      clinic_id: params.clinicId,
      script_id: params.scriptId ?? null,
      prompt: params.prompt,
      replicate_model: params.replicate_model,
      duration_sec: params.duration_sec,
      aspect_ratio: params.aspect_ratio,
      resolution: params.resolution,
      category_id: params.categoryId ?? null,
      status: params.status ?? 'pending',
    })
    .select('id')
    .single()
  if (error || !data) throw error ?? new Error('createVideoSet: insert returned no row')
  return { id: data.id }
}

export async function markVideoRendered(params: {
  id: string
  replicate_prediction_id: string
  storage_path: string
  public_url: string
}): Promise<void> {
  const supabase = createServerClient()
  const { error } = await supabase
    .from('video_sets')
    .update({
      status: 'rendered',
      replicate_prediction_id: params.replicate_prediction_id,
      storage_path: params.storage_path,
      public_url: params.public_url,
    })
    .eq('id', params.id)
  if (error) throw error
}

export async function markVideoFailed(id: string, message: string): Promise<void> {
  const supabase = createServerClient()
  const { error } = await supabase
    .from('video_sets')
    .update({ status: 'failed', error: message.slice(0, 1000) })
    .eq('id', id)
  if (error) throw error
}

// Download an mp4 from a (Replicate) URL and upload to clinic-videos
// bucket. Returns the storage path + public URL.
export async function uploadVideoFromUrl(params: {
  clinicId: string
  videoId: string
  sourceUrl: string
}): Promise<{ storage_path: string; public_url: string }> {
  const res = await fetch(params.sourceUrl)
  if (!res.ok) {
    throw new Error(`uploadVideoFromUrl: source fetch ${res.status}`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  const supabase = createServerClient()
  const stamp = randomBytes(4).toString('hex')
  const path = `${params.clinicId}/${params.videoId}-${stamp}.mp4`

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buf, { contentType: 'video/mp4', upsert: true })
  if (upErr) throw upErr

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path)

  return { storage_path: path, public_url: publicUrl }
}

export async function loadVideos(
  clinicId: string,
  limit = 50
): Promise<VideoListItem[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('video_sets')
    .select(
      'id, prompt, public_url, duration_sec, aspect_ratio, resolution, status, created_at, clinic_categories ( id, name, emoji )'
    )
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  const nowIso = new Date().toISOString()
  return (data ?? []).map((r) => {
    const cat = Array.isArray(r.clinic_categories)
      ? r.clinic_categories[0]
      : r.clinic_categories
    return {
      id: r.id,
      prompt: r.prompt,
      public_url: r.public_url,
      duration_sec: r.duration_sec,
      aspect_ratio: r.aspect_ratio,
      resolution: r.resolution,
      status: (r.status ?? 'pending') as VideoStatus,
      created_at: r.created_at ?? nowIso,
      category: cat ? { id: cat.id, name: cat.name, emoji: cat.emoji } : null,
    }
  })
}

export async function loadVideo(id: string): Promise<VideoSet | null> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('video_sets')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return null
  return data as VideoSet
}

export async function deleteVideo(id: string): Promise<void> {
  const supabase = createServerClient()
  const { data: row } = await supabase
    .from('video_sets')
    .select('storage_path')
    .eq('id', id)
    .maybeSingle()
  if (row?.storage_path) {
    await supabase.storage.from(BUCKET).remove([row.storage_path])
  }
  const { error } = await supabase.from('video_sets').delete().eq('id', id)
  if (error) throw error
}
