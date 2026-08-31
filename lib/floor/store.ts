import { createServerClient } from '@/lib/supabase/server'
import {
  floorDriveUrl,
  floorThumbUrl,
  splitUploader,
  type FloorFile,
} from './drive'

// Supabase CRUD for floor_media (migration 052) — the mirror of the
// clinic's Google-Form upload folder. Unique on (clinic_id,
// drive_file_id), so a re-sync of the same folder inserts only what
// is genuinely new; that "genuinely new" set is what the push
// notification and the "N new" badge are built on.

export interface FloorMediaRow {
  id: string
  clinic_id: string
  drive_file_id: string
  file_name: string
  kind: 'photo' | 'video'
  mime_type: string
  size_bytes: number | null
  width: number | null
  height: number | null
  duration_sec: number | null
  uploader: string | null
  drive_folder_name: string | null
  drive_url: string
  thumbnail_url: string | null
  uploaded_at: string
  created_at: string
}

// The folder id lives on the clinics row (set in the UI). The env var
// is a fallback for the default clips clinic, mirroring how the clips
// Inbox resolves.
export async function getFloorFolderId(clinicId: string): Promise<string | null> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('clinics')
    .select('drive_floor_folder_id')
    .eq('id', clinicId)
    .maybeSingle()
  // Fail-soft: migration not applied yet → fall back to env instead of
  // breaking the page that asked.
  if (error) {
    console.warn(`floor: folder lookup failed — ${error.message}`)
  }
  const stored = (data as { drive_floor_folder_id: string | null } | null)
    ?.drive_floor_folder_id
  if (stored) return stored
  const envFolder = process.env.GOOGLE_DRIVE_FLOOR_FOLDER_ID
  const envClinic = process.env.CLIPS_DEFAULT_CLINIC_ID
  if (envFolder && (!envClinic || envClinic === clinicId)) return envFolder
  return null
}

export async function setFloorFolderId(
  clinicId: string,
  folderId: string | null
): Promise<void> {
  const supabase = createServerClient()
  const { error } = await supabase
    .from('clinics')
    .update({ drive_floor_folder_id: folderId })
    .eq('id', clinicId)
  if (error) throw error
}

// Every clinic the cron should walk: an explicitly connected folder,
// plus the env folder attributed to the default clips clinic.
export async function listClinicsWithFloorFolder(): Promise<
  Array<{ clinicId: string; clinicName: string; folderId: string }>
> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('clinics')
    .select('id, name, drive_floor_folder_id')
    .not('drive_floor_folder_id', 'is', null)
  if (error) {
    console.warn(`floor: clinic list failed — ${error.message}`)
    return []
  }
  const rows = (data ?? []) as Array<{
    id: string
    name: string | null
    drive_floor_folder_id: string | null
  }>
  const out = rows
    .filter((r) => r.drive_floor_folder_id)
    .map((r) => ({
      clinicId: r.id,
      clinicName: r.name ?? 'Clinic',
      folderId: r.drive_floor_folder_id as string,
    }))

  const envFolder = process.env.GOOGLE_DRIVE_FLOOR_FOLDER_ID
  const envClinic = process.env.CLIPS_DEFAULT_CLINIC_ID
  if (envFolder && envClinic && !out.some((c) => c.clinicId === envClinic)) {
    out.push({ clinicId: envClinic, clinicName: 'Clinic', folderId: envFolder })
  }
  return out
}

// Insert the files this clinic has not seen before. ON CONFLICT DO
// NOTHING (ignoreDuplicates) + select = the returned rows ARE the new
// ones, with no read-then-write race between two syncs.
export async function insertNewFloorMedia(
  clinicId: string,
  files: FloorFile[]
): Promise<FloorMediaRow[]> {
  if (files.length === 0) return []
  const supabase = createServerClient()
  const payload = files.map((f) => {
    const { title, uploader } = splitUploader(f.name)
    return {
      clinic_id: clinicId,
      drive_file_id: f.id,
      file_name: title.slice(0, 200),
      kind: f.kind,
      mime_type: f.mimeType,
      size_bytes: f.size,
      width: f.width,
      height: f.height,
      duration_sec: f.durationSec,
      uploader: uploader?.slice(0, 60) ?? null,
      drive_folder_name: f.folderName?.slice(0, 120) ?? null,
      drive_url: floorDriveUrl(f.id),
      thumbnail_url: floorThumbUrl(f.id),
      uploaded_at: f.createdTime,
    }
  })

  const { data, error } = await supabase
    .from('floor_media')
    .upsert(payload, {
      onConflict: 'clinic_id,drive_file_id',
      ignoreDuplicates: true,
    })
    .select('*')
  if (error) throw error
  return (data ?? []) as unknown as FloorMediaRow[]
}

// Drive fills a video's duration/dimensions at the same time it renders
// the poster frame — minutes to hours after the upload. The first sync
// therefore stores nulls, and the insert path (ON CONFLICT DO NOTHING)
// would never revisit them. This tops up rows whose metadata was still
// missing, using whatever the current listing knows.
export async function backfillFloorMetadata(
  clinicId: string,
  files: FloorFile[]
): Promise<number> {
  const withMeta = files.filter((f) => f.durationSec != null || f.width != null)
  if (withMeta.length === 0) return 0

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('floor_media')
    .select('id, drive_file_id, duration_sec, width')
    .eq('clinic_id', clinicId)
    .is('duration_sec', null)
  if (error || !data || data.length === 0) return 0

  const stale = new Map(
    (data as Array<{ id: string; drive_file_id: string }>).map((r) => [
      r.drive_file_id,
      r.id,
    ])
  )
  let updated = 0
  for (const f of withMeta) {
    const rowId = stale.get(f.id)
    if (!rowId) continue
    const { error: upErr } = await supabase
      .from('floor_media')
      .update({
        duration_sec: f.durationSec,
        width: f.width,
        height: f.height,
        size_bytes: f.size,
      })
      .eq('id', rowId)
    if (!upErr) updated += 1
  }
  return updated
}

export async function loadFloorMedia(
  clinicId: string,
  limit = 200
): Promise<FloorMediaRow[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('floor_media')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('uploaded_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as unknown as FloorMediaRow[]
}

// Drops rows whose Drive file is gone, so deleting from Drive also
// clears the gallery. Called with the ids the sync just saw.
export async function pruneMissingFloorMedia(
  clinicId: string,
  liveFileIds: string[]
): Promise<number> {
  if (liveFileIds.length === 0) return 0
  const supabase = createServerClient()
  const { data: known } = await supabase
    .from('floor_media')
    .select('id, drive_file_id')
    .eq('clinic_id', clinicId)
  const rows = (known ?? []) as Array<{ id: string; drive_file_id: string }>
  const live = new Set(liveFileIds)
  const stale = rows.filter((r) => !live.has(r.drive_file_id)).map((r) => r.id)
  if (stale.length === 0) return 0
  await supabase.from('floor_media').delete().in('id', stale)
  return stale.length
}
