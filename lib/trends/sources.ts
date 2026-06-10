import { createServerClient } from '@/lib/supabase/server'

export type TrendPlatform = 'instagram' | 'tiktok' | 'youtube'
export type TrendKind = 'account' | 'hashtag'

export interface TrendSource {
  id: string
  clinic_id: string
  platform: TrendPlatform
  kind: TrendKind
  handle_or_hashtag: string
  active: boolean
  last_scanned_at: string | null
  notes: string | null
  created_at: string
}

export async function loadTrendSources(
  clinicId: string,
  opts?: { activeOnly?: boolean }
): Promise<TrendSource[]> {
  const supabase = createServerClient()
  let q = supabase
    .from('trend_sources')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false })
  if (opts?.activeOnly) q = q.eq('active', true)
  const { data } = await q
  return (data ?? []) as TrendSource[]
}

export async function upsertTrendSource(params: {
  clinicId: string
  platform: TrendPlatform
  kind: TrendKind
  handleOrHashtag: string
  notes?: string | null
}): Promise<TrendSource> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('trend_sources')
    .upsert(
      {
        clinic_id: params.clinicId,
        platform: params.platform,
        kind: params.kind,
        handle_or_hashtag: params.handleOrHashtag.trim(),
        notes: params.notes ?? null,
        active: true,
      },
      { onConflict: 'clinic_id,platform,kind,handle_or_hashtag' }
    )
    .select('*')
    .single()
  if (error || !data) {
    throw new Error(`upsertTrendSource failed: ${error?.message ?? 'unknown'}`)
  }
  return data as TrendSource
}

export async function setTrendSourceActive(
  id: string,
  clinicId: string,
  active: boolean
): Promise<void> {
  const supabase = createServerClient()
  await supabase
    .from('trend_sources')
    .update({ active })
    .eq('id', id)
    .eq('clinic_id', clinicId)
}

export async function deleteTrendSource(
  id: string,
  clinicId: string
): Promise<void> {
  const supabase = createServerClient()
  await supabase
    .from('trend_sources')
    .delete()
    .eq('id', id)
    .eq('clinic_id', clinicId)
}

export async function touchTrendScanned(id: string): Promise<void> {
  const supabase = createServerClient()
  await supabase
    .from('trend_sources')
    .update({ last_scanned_at: new Date().toISOString() })
    .eq('id', id)
}

// Build the account/hashtag URL the ingest skill points yt-dlp at. The
// skill itself resolves the individual fresh videos from this listing URL.
export function buildSourceUrl(source: TrendSource): string {
  const raw = source.handle_or_hashtag.trim()
  const handle = raw.replace(/^[@#]/, '')
  if (source.platform === 'instagram') {
    return source.kind === 'hashtag'
      ? `https://www.instagram.com/explore/tags/${handle}/`
      : `https://www.instagram.com/${handle}/`
  }
  if (source.platform === 'tiktok') {
    return source.kind === 'hashtag'
      ? `https://www.tiktok.com/tag/${handle}`
      : `https://www.tiktok.com/@${handle}`
  }
  // youtube
  return source.kind === 'hashtag'
    ? `https://www.youtube.com/hashtag/${handle}`
    : `https://www.youtube.com/@${handle}`
}
