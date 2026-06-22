import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { resolveAccess } from '@/lib/auth/session'
import { uploadRecording } from '@/lib/google/recordings'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: Request) {
  const access = await resolveAccess()
  if (!access) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const url = new URL(req.url)
  const clinicId =
    access.role === 'admin'
      ? url.searchParams.get('clinicId') ?? ''
      : access.clinicId

  if (!clinicId) return NextResponse.json({ error: 'clinicId required' }, { status: 400 })

  const formData = await req.formData()
  const file = formData.get('video') as File | null
  const title = ((formData.get('title') as string) || 'Untitled').slice(0, 200)
  const scriptId = (formData.get('scriptId') as string) || null
  const durationRaw = formData.get('duration')
  const duration = durationRaw ? parseInt(durationRaw as string, 10) || null : null

  if (!file) return NextResponse.json({ error: 'video file is required' }, { status: 400 })

  const supabase = createServerClient()
  const { data: clinic } = await supabase
    .from('clinics')
    .select('name')
    .eq('id', clinicId)
    .single()

  if (!clinic) return NextResponse.json({ error: 'clinic not found' }, { status: 404 })

  const safeTitle = title.replace(/[^a-zA-Z0-9 -]/g, '').trim().replace(/\s+/g, '_') || 'recording'
  const dateStr = new Date().toISOString().split('T')[0]
  const ext = file.type === 'video/mp4' ? 'mp4' : 'webm'
  const filename = `${dateStr}_${safeTitle}.${ext}`

  const buffer = Buffer.from(await file.arrayBuffer())

  const { fileId, webViewLink } = await uploadRecording(
    clinic.name,
    filename,
    buffer,
    file.type || 'video/webm'
  )

  const { data: recording, error: dbErr } = await supabase
    .from('clinic_recordings')
    .insert({
      clinic_id: clinicId,
      script_id: scriptId || null,
      title,
      drive_file_id: fileId,
      drive_url: webViewLink,
      duration_sec: duration,
      size_bytes: file.size,
      status: 'final',
    })
    .select('id')
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return NextResponse.json({ recording, driveUrl: webViewLink })
}
