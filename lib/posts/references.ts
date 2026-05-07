import { randomBytes } from 'crypto'
import { createServerClient } from '@/lib/supabase/server'

const BUCKET = 'post-references'

export type PostReferenceMode = 'photo' | 'clean'
export type PostReferenceRole = 'cover' | 'body' | 'cta' | 'full_post'

export interface PostReference {
  id: string
  clinic_id: string
  image_url: string
  storage_path: string | null
  label: string | null
  mode: PostReferenceMode | null
  role: PostReferenceRole | null
  category_slug: string | null
  notes: string | null
  position: number
  active: boolean
  created_at: string
}

export interface UploadInput {
  bytes: Uint8Array
  contentType: string
  ext: string
}

export interface ReferenceMeta {
  label?: string | null
  mode?: PostReferenceMode | null
  role?: PostReferenceRole | null
  category_slug?: string | null
  notes?: string | null
}

export async function loadPostReferences(
  clinicId: string
): Promise<PostReference[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('post_references')
    .select(
      'id, clinic_id, image_url, storage_path, label, mode, role, category_slug, notes, position, active, created_at'
    )
    .eq('clinic_id', clinicId)
    .eq('active', true)
    .order('position', { ascending: true })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as PostReference[]
}

export async function uploadPostReference(
  clinicId: string,
  file: UploadInput,
  meta: ReferenceMeta
): Promise<PostReference> {
  const supabase = createServerClient()
  const version = randomBytes(6).toString('hex')
  const path = `${clinicId}/${version}.${file.ext}`

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file.bytes, {
      contentType: file.contentType,
      upsert: false,
    })
  if (uploadErr) throw uploadErr

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path)

  const { count } = await supabase
    .from('post_references')
    .select('id', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
    .eq('active', true)

  const { data, error } = await supabase
    .from('post_references')
    .insert({
      clinic_id: clinicId,
      image_url: publicUrl,
      storage_path: path,
      label: meta.label?.trim() || null,
      mode: meta.mode ?? null,
      role: meta.role ?? null,
      category_slug: meta.category_slug?.trim() || null,
      notes: meta.notes?.trim() || null,
      position: count ?? 0,
    })
    .select()
    .single()
  if (error || !data) throw error ?? new Error('insert returned no row')
  return data as PostReference
}

export async function deletePostReference(referenceId: string): Promise<void> {
  const supabase = createServerClient()
  const { data, error: fetchErr } = await supabase
    .from('post_references')
    .select('storage_path')
    .eq('id', referenceId)
    .maybeSingle()
  if (fetchErr) throw fetchErr

  if (data?.storage_path) {
    await supabase.storage.from(BUCKET).remove([data.storage_path])
  }

  const { error } = await supabase
    .from('post_references')
    .delete()
    .eq('id', referenceId)
  if (error) throw error
}

export async function updatePostReferenceMeta(
  referenceId: string,
  meta: ReferenceMeta
): Promise<PostReference> {
  const supabase = createServerClient()
  const update: {
    label?: string | null
    mode?: string | null
    role?: string | null
    category_slug?: string | null
    notes?: string | null
  } = {}
  if (meta.label !== undefined) update.label = meta.label?.trim() || null
  if (meta.mode !== undefined) update.mode = meta.mode
  if (meta.role !== undefined) update.role = meta.role
  if (meta.category_slug !== undefined)
    update.category_slug = meta.category_slug?.trim() || null
  if (meta.notes !== undefined) update.notes = meta.notes?.trim() || null

  const { data, error } = await supabase
    .from('post_references')
    .update(update)
    .eq('id', referenceId)
    .select()
    .single()
  if (error || !data) throw error ?? new Error('update returned no row')
  return data as PostReference
}
