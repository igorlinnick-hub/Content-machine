import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { resolveAccess } from '@/lib/auth/session'
import { sendPushToClinic } from '@/lib/push/send'
import { allowLinkView } from '@/lib/google/drive'

export const runtime = 'nodejs'

interface ConfirmBody {
  fileId: string
  driveUrl: string
  title?: string
  scriptId?: string | null
  duration?: number | null
  sizeBytes?: number | null
}

export async function POST(req: Request) {
  const access = await resolveAccess()
  if (!access) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const url = new URL(req.url)
  const clinicId =
    access.role === 'admin'
      ? url.searchParams.get('clinicId') ?? ''
      : access.clinicId

  if (!clinicId) return NextResponse.json({ error: 'clinicId required' }, { status: 400 })

  let body: ConfirmBody
  try {
    body = (await req.json()) as ConfirmBody
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  if (!body.fileId) return NextResponse.json({ error: 'fileId required' }, { status: 400 })
  if (!body.driveUrl) return NextResponse.json({ error: 'driveUrl required' }, { status: 400 })

  const supabase = createServerClient()
  const { data: recording, error } = await supabase
    .from('clinic_recordings')
    .insert({
      clinic_id: clinicId,
      script_id: body.scriptId ?? null,
      title: (body.title || 'Untitled').slice(0, 200),
      drive_file_id: body.fileId,
      drive_url: body.driveUrl,
      duration_sec: body.duration ?? null,
      size_bytes: body.sizeBytes ?? null,
      status: 'final',
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Link-view permission so the admin preview iframe can play the
  // file regardless of which Google account the browser holds.
  await allowLinkView(body.fileId).catch(() => {})

  // Same "new recording" ping the proxy upload path sends — the
  // direct-to-Drive path lands here instead. Best-effort.
  const { data: clinic } = await supabase
    .from('clinics')
    .select('name')
    .eq('id', clinicId)
    .maybeSingle()
  const mins = body.duration
    ? `${Math.floor(body.duration / 60)}:${String(body.duration % 60).padStart(2, '0')}`
    : null
  await sendPushToClinic(clinicId, {
    title: 'New recording',
    body: `${clinic?.name ?? 'Clinic'}: ${(body.title || 'Untitled').slice(0, 120)}${mins ? ` (${mins})` : ''}`,
    url: `/clips?clinicId=${clinicId}`,
  })

  return NextResponse.json({ recording })
}
