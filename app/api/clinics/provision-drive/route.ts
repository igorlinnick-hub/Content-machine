import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { resolveAccess } from '@/lib/auth/session'
import { provisionClinicDriveFolders } from '@/lib/google/clinicFolders'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Provision the Drive workspace ({Clinic — Doctor}/Inbox|Originals|
// Finals) for an EXISTING clinic. Onboarding does this for new
// clinics; this admin route covers the ones created before migration
// 037 (HWC). Idempotent — re-running returns the stored ids.

export async function POST(req: Request) {
  const access = await resolveAccess()
  if (!access) return NextResponse.json({ error: 'auth required' }, { status: 401 })
  if (access.role !== 'admin') {
    return NextResponse.json({ error: 'admin required' }, { status: 403 })
  }

  let body: { clinicId?: string }
  try {
    body = (await req.json()) as { clinicId?: string }
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  if (!body.clinicId) {
    return NextResponse.json({ error: 'clinicId required' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data: clinic } = await supabase
    .from('clinics')
    .select('id, name, doctor_name')
    .eq('id', body.clinicId)
    .maybeSingle()
  if (!clinic) return NextResponse.json({ error: 'clinic not found' }, { status: 404 })

  try {
    const folders = await provisionClinicDriveFolders({
      clinicId: clinic.id as string,
      clinicName: clinic.name as string,
      doctorName: (clinic.doctor_name as string | null) ?? null,
    })
    if (!folders) {
      return NextResponse.json(
        { error: 'GOOGLE_DRIVE_CLINICS_ROOT_ID is not set' },
        { status: 400 }
      )
    }
    return NextResponse.json({ ok: true, folders })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'provision failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
