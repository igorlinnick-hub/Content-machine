import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { resolveAccess } from '@/lib/auth/session'
import { deleteRecordingFromDrive } from '@/lib/google/recordings'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const access = await resolveAccess()
  if (!access) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const clinicId =
    access.role === 'admin'
      ? new URL(req.url).searchParams.get('clinicId') ?? ''
      : access.clinicId

  if (!clinicId) return NextResponse.json({ error: 'clinicId required' }, { status: 400 })

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('clinic_recordings')
    .select('id, title, drive_url, duration_sec, size_bytes, created_at')
    .eq('clinic_id', clinicId)
    .eq('status', 'final')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ recordings: data })
}

export async function DELETE(req: Request) {
  const access = await resolveAccess()
  if (!access) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const body = (await req.json()) as { recordingId: string }
  if (!body.recordingId) return NextResponse.json({ error: 'recordingId required' }, { status: 400 })

  const supabase = createServerClient()
  const { data: recording, error: fetchErr } = await supabase
    .from('clinic_recordings')
    .select('id, drive_file_id, clinic_id')
    .eq('id', body.recordingId)
    .single()

  if (fetchErr || !recording) return NextResponse.json({ error: 'not found' }, { status: 404 })

  if (access.role !== 'admin' && recording.clinic_id !== access.clinicId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  await supabase
    .from('clinic_recordings')
    .update({ status: 'deleted' })
    .eq('id', body.recordingId)

  try {
    await deleteRecordingFromDrive(recording.drive_file_id)
  } catch {
    // best-effort — DB is already soft-deleted
  }

  return NextResponse.json({ ok: true })
}
