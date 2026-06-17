import { createServerClient } from '@/lib/supabase/server'
import { publicUrl } from '@/lib/arsenal/storage'

// studio_videos is the Studio board's OWN curated base — the reference
// reels the marketing team uploads for the people who shoot content. It is
// completely separate from script_arsenal (the doctor's writing styles).

export interface StudioVideoBeat {
  name: string
  text: string
}

export interface StudioVideoStructure {
  beats?: StudioVideoBeat[]
  notes?: string
}

// Funnel stage. candidate -> liked (anyone) -> shotlist (admin only).
export type StudioStatus = 'candidate' | 'liked' | 'shotlist' | 'rejected'

export interface StudioVideo {
  id: string
  clinic_id: string
  source_url: string | null
  source_platform: string | null
  author_handle: string | null
  view_count: number | null
  title: string | null
  style_description: string | null
  structure: StudioVideoStructure
  caption: string | null
  video_storage_path: string | null
  thumbnail_storage_path: string | null
  is_active: boolean
  status: StudioStatus
  current_script_id: string | null
  created_at: string
}

// Bracketed scaffold from the video's beats, for the collapsed "Template"
// view + the Writer's pinned format.
export function studioScaffold(video: StudioVideo): string {
  const beats = video.structure?.beats ?? []
  if (beats.length === 0) {
    return `[Hook — ${video.style_description ?? 'open strong'}]\n[Body]\n[CTA]`
  }
  return beats.map((b) => `[${b.name} — ${b.text}]`).join('\n')
}

export async function loadStudioVideo(
  id: string,
  clinicId: string
): Promise<StudioVideo | null> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('studio_videos')
    .select('*')
    .eq('id', id)
    .eq('clinic_id', clinicId)
    .maybeSingle()
  return (data as unknown as StudioVideo | null) ?? null
}

export interface StudioVideoView extends StudioVideo {
  video_url: string | null
  thumbnail_url: string | null
}

function decorate(v: StudioVideo): StudioVideoView {
  return {
    ...v,
    video_url: publicUrl(v.video_storage_path),
    thumbnail_url: publicUrl(v.thumbnail_storage_path),
  }
}

export async function listStudioVideos(
  clinicId: string
): Promise<StudioVideoView[]> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('studio_videos')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false })
  return ((data ?? []) as unknown as StudioVideo[]).map(decorate)
}

// Videos in one funnel stage (Discover / Liked / Shot List).
export async function listStudioVideosByStatus(
  clinicId: string,
  status: StudioStatus
): Promise<StudioVideoView[]> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('studio_videos')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('status', status)
    .order('view_count', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
  return ((data ?? []) as unknown as StudioVideo[]).map(decorate)
}

export async function setStudioStatus(
  id: string,
  clinicId: string,
  status: StudioStatus
): Promise<void> {
  const supabase = createServerClient()
  await supabase
    .from('studio_videos')
    .update({ status })
    .eq('id', id)
    .eq('clinic_id', clinicId)
}

export async function setStudioCurrentScript(
  id: string,
  clinicId: string,
  scriptId: string
): Promise<void> {
  const supabase = createServerClient()
  await supabase
    .from('studio_videos')
    .update({ current_script_id: scriptId })
    .eq('id', id)
    .eq('clinic_id', clinicId)
}

// Next playable video from the curated base not already on the board.
// No view-count gate — the pool is fully human-curated.
export async function pickNextStudioVideo(
  clinicId: string,
  opts: { exclude?: string[] }
): Promise<{ videoId: string } | null> {
  const exclude = new Set((opts.exclude ?? []).filter(Boolean))
  const supabase = createServerClient()
  const { data } = await supabase
    .from('studio_videos')
    .select('id, view_count')
    .eq('clinic_id', clinicId)
    .eq('is_active', true)
    .not('video_storage_path', 'is', null)
    .order('view_count', { ascending: false, nullsFirst: false })
    .limit(60)
  const pool = ((data ?? []) as { id: string }[]).filter((r) => !exclude.has(r.id))
  if (pool.length === 0) return null
  return { videoId: pool[0].id }
}

export async function deleteStudioVideo(
  id: string,
  clinicId: string
): Promise<void> {
  const supabase = createServerClient()
  await supabase.from('studio_videos').delete().eq('id', id).eq('clinic_id', clinicId)
}
