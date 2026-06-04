import { createServerClient } from '@/lib/supabase/server'

// Resolve the effective Drive folder ID for a slide_set.
// Priority: slide_sets.drive_folder_id (set at generate time, may
// already be an explicit override) → clinic_categories.drive_folder_id
// fallback. Returns null when neither is set — caller renders the
// brand-coloured fallback in that case.
//
// Single source of truth so the photo loader, the post detail route,
// and the PhotoPicker indexer all agree on which folder a given
// slide_set is "linked to".
export async function resolveEffectiveFolderId(
  slideSetId: string
): Promise<string | null> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('slide_sets')
    .select('drive_folder_id, clinic_categories ( drive_folder_id )')
    .eq('id', slideSetId)
    .maybeSingle()
  if (error || !data) return null

  if (data.drive_folder_id) return data.drive_folder_id

  const cat = Array.isArray(data.clinic_categories)
    ? data.clinic_categories[0]
    : data.clinic_categories
  return (cat as { drive_folder_id?: string | null } | null | undefined)
    ?.drive_folder_id ?? null
}
