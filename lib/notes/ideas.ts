import { randomBytes } from 'crypto'
import { createServerClient } from '@/lib/supabase/server'

const BUCKET = 'note-photos'

export type NoteSourceKind = 'typed' | 'photo'
export type TidyStatus = 'raw' | 'tidied' | 'failed'

export interface IdeaNote {
  id: string
  clinic_id: string
  title: string | null
  body: string
  raw_body: string
  source: NoteSourceKind
  tidy_status: TidyStatus
  tidy_flags: string[]
  image_urls: string[]
  storage_paths: string[]
  pinned: boolean
  archived: boolean
  created_at: string
  updated_at: string
}

const COLUMNS =
  'id, clinic_id, title, body, raw_body, source, tidy_status, tidy_flags, image_urls, storage_paths, pinned, archived, created_at, updated_at'

export async function loadIdeaNotes(
  clinicId: string,
  opts: { archived?: boolean } = {}
): Promise<IdeaNote[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('idea_notes')
    .select(COLUMNS)
    .eq('clinic_id', clinicId)
    .eq('archived', opts.archived ?? false)
    // Pinned first, then most recently touched — the note you are
    // working on right now sits at the top without any sorting UI.
    .order('pinned', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []) as IdeaNote[]
}

export async function loadIdeaNote(noteId: string): Promise<IdeaNote | null> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('idea_notes')
    .select(COLUMNS)
    .eq('id', noteId)
    .maybeSingle()
  if (error) throw error
  return (data as IdeaNote | null) ?? null
}

export interface CreateNoteInput {
  rawBody: string
  body?: string
  title?: string | null
  source?: NoteSourceKind
  tidyStatus?: TidyStatus
  tidyFlags?: string[]
  imageUrls?: string[]
  storagePaths?: string[]
}

export async function createIdeaNote(
  clinicId: string,
  input: CreateNoteInput
): Promise<IdeaNote> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('idea_notes')
    .insert({
      clinic_id: clinicId,
      title: input.title ?? null,
      // body defaults to the raw text: a note is never empty on screen
      // just because the tidy pass was off or failed.
      body: input.body ?? input.rawBody,
      raw_body: input.rawBody,
      source: input.source ?? 'typed',
      tidy_status: input.tidyStatus ?? 'raw',
      tidy_flags: input.tidyFlags ?? [],
      image_urls: input.imageUrls ?? [],
      storage_paths: input.storagePaths ?? [],
    })
    .select(COLUMNS)
    .single()
  if (error || !data) throw error ?? new Error('createIdeaNote: no row returned')
  return data as IdeaNote
}

export interface UpdateNoteInput {
  title?: string | null
  body?: string
  tidyStatus?: TidyStatus
  tidyFlags?: string[]
  pinned?: boolean
  archived?: boolean
}

export async function updateIdeaNote(
  noteId: string,
  patch: UpdateNoteInput
): Promise<IdeaNote> {
  const supabase = createServerClient()
  const update = {
    updated_at: new Date().toISOString(),
    ...(patch.title !== undefined ? { title: patch.title } : {}),
    ...(patch.body !== undefined ? { body: patch.body } : {}),
    ...(patch.tidyStatus !== undefined ? { tidy_status: patch.tidyStatus } : {}),
    ...(patch.tidyFlags !== undefined ? { tidy_flags: patch.tidyFlags } : {}),
    ...(patch.pinned !== undefined ? { pinned: patch.pinned } : {}),
    ...(patch.archived !== undefined ? { archived: patch.archived } : {}),
  }

  const { data, error } = await supabase
    .from('idea_notes')
    .update(update)
    .eq('id', noteId)
    .select(COLUMNS)
    .single()
  if (error || !data) throw error ?? new Error('updateIdeaNote: no row returned')
  return data as IdeaNote
}

export async function deleteIdeaNote(noteId: string): Promise<void> {
  const supabase = createServerClient()
  const { data, error: fetchErr } = await supabase
    .from('idea_notes')
    .select('storage_paths')
    .eq('id', noteId)
    .maybeSingle()
  if (fetchErr) throw fetchErr

  const paths = (data?.storage_paths ?? []) as string[]
  if (paths.length > 0) {
    await supabase.storage.from(BUCKET).remove(paths)
  }

  const { error } = await supabase.from('idea_notes').delete().eq('id', noteId)
  if (error) throw error
}

export interface PhotoUpload {
  bytes: Uint8Array
  contentType: string
  ext: string
}

// Store a photographed page. Returns the public URL + the storage path
// so deleting the note can clean the bucket up after itself.
export async function uploadNotePhoto(
  clinicId: string,
  file: PhotoUpload
): Promise<{ url: string; path: string }> {
  const supabase = createServerClient()
  const version = randomBytes(6).toString('hex')
  const path = `${clinicId}/${version}.${file.ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file.bytes, { contentType: file.contentType, upsert: false })
  if (error) throw error

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: publicUrl, path }
}
