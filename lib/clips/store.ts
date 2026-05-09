import { createServerClient } from '@/lib/supabase/server'

// Supabase CRUD for the clips table (migration 012). One row per
// inbox file we attempt to process; status walks pending →
// processing → cleaned (or failed). Unique on (clinic_id,
// drive_inbox_file_id) so re-running on the same Inbox file
// updates the row instead of duplicating.

export type ClipStatus = 'pending' | 'processing' | 'cleaned' | 'failed'

export interface ClipRow {
  id: string
  clinic_id: string
  drive_inbox_file_id: string
  drive_inbox_file_name: string
  drive_clip_folder_id: string | null
  status: ClipStatus
  duration_in_sec: number | null
  duration_out_sec: number | null
  cuts_filler_count: number | null
  cuts_silence_count: number | null
  cleaned_file_id: string | null
  transcript_txt_file_id: string | null
  transcript_srt_file_id: string | null
  triggered_chat_id: string | null
  error: string | null
  created_at: string
  completed_at: string | null
}

export async function upsertPendingClip(params: {
  clinicId: string
  driveInboxFileId: string
  driveInboxFileName: string
  triggeredChatId?: string | null
}): Promise<{ id: string }> {
  const supabase = createServerClient()
  const { data: existing } = await supabase
    .from('clips')
    .select('id, status')
    .eq('clinic_id', params.clinicId)
    .eq('drive_inbox_file_id', params.driveInboxFileId)
    .maybeSingle()

  if (existing) return { id: existing.id }

  const { data, error } = await supabase
    .from('clips')
    .insert({
      clinic_id: params.clinicId,
      drive_inbox_file_id: params.driveInboxFileId,
      drive_inbox_file_name: params.driveInboxFileName,
      triggered_chat_id: params.triggeredChatId ?? null,
      status: 'pending',
    })
    .select('id')
    .single()
  if (error || !data)
    throw error ?? new Error('upsertPendingClip: insert returned no row')
  return { id: data.id }
}

export async function markClipProcessing(clipId: string): Promise<void> {
  const supabase = createServerClient()
  const { error } = await supabase
    .from('clips')
    .update({ status: 'processing' })
    .eq('id', clipId)
  if (error) throw error
}

export async function markClipCleaned(params: {
  clipId: string
  driveClipFolderId: string
  durationInSec: number
  durationOutSec: number
  fillerCount: number
  silenceCount: number
  cleanedFileId: string
  transcriptTxtFileId: string
  transcriptSrtFileId: string
}): Promise<void> {
  const supabase = createServerClient()
  const { error } = await supabase
    .from('clips')
    .update({
      status: 'cleaned',
      drive_clip_folder_id: params.driveClipFolderId,
      duration_in_sec: params.durationInSec,
      duration_out_sec: params.durationOutSec,
      cuts_filler_count: params.fillerCount,
      cuts_silence_count: params.silenceCount,
      cleaned_file_id: params.cleanedFileId,
      transcript_txt_file_id: params.transcriptTxtFileId,
      transcript_srt_file_id: params.transcriptSrtFileId,
      completed_at: new Date().toISOString(),
    })
    .eq('id', params.clipId)
  if (error) throw error
}

export async function markClipFailed(
  clipId: string,
  errorMessage: string
): Promise<void> {
  const supabase = createServerClient()
  const { error } = await supabase
    .from('clips')
    .update({
      status: 'failed',
      error: errorMessage.slice(0, 1000),
      completed_at: new Date().toISOString(),
    })
    .eq('id', clipId)
  if (error) throw error
}

export async function loadRecentClips(
  clinicId: string,
  limit = 10
): Promise<ClipRow[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('clips')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return ((data ?? []) as unknown as ClipRow[])
}
