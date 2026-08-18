import { createServerClient } from '@/lib/supabase/server'

// Where a clinic keeps its own photographs (clinics.photo_library_folder_id,
// migration 048). Null when the clinic has not been pointed at a Drive
// folder yet — callers degrade the slide to AI rather than guessing.
export async function getPhotoLibraryFolderId(clinicId: string): Promise<string | null> {
  const supabase = createServerClient() as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (
          c: string,
          v: string
        ) => {
          maybeSingle: () => Promise<{
            data: { photo_library_folder_id: string | null } | null
            error: { message: string } | null
          }>
        }
      }
    }
  }
  const { data, error } = await supabase
    .from('clinics')
    .select('photo_library_folder_id')
    .eq('id', clinicId)
    .maybeSingle()
  if (error) throw new Error(`photo library folder lookup: ${error.message}`)
  return data?.photo_library_folder_id?.trim() || null
}
