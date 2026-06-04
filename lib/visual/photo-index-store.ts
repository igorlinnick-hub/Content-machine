import { createServerClient } from '@/lib/supabase/server'

// CRUD for the photo_index table (migration 019). Owns the row shape
// locally — types/supabase.ts is not updated for this table because
// the generated client gets verbose, and every read/write happens
// through this module anyway, so a single cast at the boundary is
// safer than mutating the generated file.

export interface PhotoIndexRow {
  id: string
  clinic_id: string
  drive_folder_id: string
  drive_file_id: string
  file_name: string | null
  description: string
  tags: string[]
  description_model: string
  indexed_at: string
}

interface PhotoIndexInsert {
  clinic_id: string
  drive_folder_id: string
  drive_file_id: string
  file_name?: string | null
  description: string
  tags?: string[]
  description_model: string
}

// All indexed photos for a given Drive folder. Returned in stable
// insertion order so the matcher's candidate list is reproducible.
export async function listPhotoIndexForFolder(
  clinicId: string,
  driveFolderId: string
): Promise<PhotoIndexRow[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('photo_index')
    .select(
      'id, clinic_id, drive_folder_id, drive_file_id, file_name, description, tags, description_model, indexed_at'
    )
    .eq('clinic_id', clinicId)
    .eq('drive_folder_id', driveFolderId)
    .order('indexed_at', { ascending: true })
    .returns<PhotoIndexRow[]>()
  if (error) throw new Error(`photo_index list: ${error.message}`)
  return data ?? []
}

// Which Drive file IDs already have an index row for this clinic?
// Used by the indexer to skip work on photos we've already described.
export async function listIndexedFileIds(
  clinicId: string,
  driveFolderId: string
): Promise<Set<string>> {
  const rows = await listPhotoIndexForFolder(clinicId, driveFolderId)
  return new Set(rows.map((r) => r.drive_file_id))
}

export async function upsertPhotoIndex(
  row: PhotoIndexInsert
): Promise<PhotoIndexRow> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('photo_index')
    .upsert(
      {
        clinic_id: row.clinic_id,
        drive_folder_id: row.drive_folder_id,
        drive_file_id: row.drive_file_id,
        file_name: row.file_name ?? null,
        description: row.description,
        tags: row.tags ?? [],
        description_model: row.description_model,
        indexed_at: new Date().toISOString(),
      },
      { onConflict: 'clinic_id,drive_file_id' }
    )
    .select(
      'id, clinic_id, drive_folder_id, drive_file_id, file_name, description, tags, description_model, indexed_at'
    )
    .single<PhotoIndexRow>()
  if (error || !data) {
    throw new Error(`photo_index upsert: ${error?.message ?? 'no row returned'}`)
  }
  return data
}

// ─── slide_sets.photo_overrides ──────────────────────────────────
// JSONB map keyed by slideIndex (as string) → drive_file_id.
// `null` value at a key clears the override (forces auto-cycle).

export type PhotoOverridesMap = Record<string, string | null>

export async function getPhotoOverrides(
  slideSetId: string
): Promise<PhotoOverridesMap> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('slide_sets')
    .select('photo_overrides')
    .eq('id', slideSetId)
    .maybeSingle()
  if (error || !data) return {}
  const raw = (data as { photo_overrides?: unknown }).photo_overrides
  if (!raw || typeof raw !== 'object') return {}
  // Defensive: only accept string keys, string-or-null values.
  const clean: PhotoOverridesMap = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string') clean[k] = v
    else if (v === null) clean[k] = null
  }
  return clean
}

export async function setPhotoOverride(
  slideSetId: string,
  slideIndex: number,
  driveFileId: string | null
): Promise<PhotoOverridesMap> {
  const current = await getPhotoOverrides(slideSetId)
  const next: PhotoOverridesMap = { ...current }
  if (driveFileId === null) {
    delete next[String(slideIndex)]
  } else {
    next[String(slideIndex)] = driveFileId
  }
  const supabase = createServerClient()
  const { error } = await supabase
    .from('slide_sets')
    .update({ photo_overrides: next })
    .eq('id', slideSetId)
  if (error) throw new Error(`set photo_override: ${error.message}`)
  return next
}
