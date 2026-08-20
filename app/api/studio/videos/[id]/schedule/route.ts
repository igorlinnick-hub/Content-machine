import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { scheduleStudioVideo, unscheduleStudioVideo } from '@/lib/studio/schedule'

export const runtime = 'nodejs'

// POST   /api/studio/videos/<id>/schedule  { clinicId?, date? }  — book a day
// DELETE /api/studio/videos/<id>/schedule  { clinicId? }         — free it
// Admin only: the shoot calendar is the boss's call, same as the Shot List.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin')
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })

  const body = (await req.json().catch(() => ({}))) as {
    clinicId?: string
    date?: string
  }
  if (!body.clinicId)
    return NextResponse.json({ error: 'clinicId required' }, { status: 400 })

  try {
    const { shootDate } = await scheduleStudioVideo(params.id, body.clinicId, body.date ?? null)
    return NextResponse.json({ ok: true, shootDate })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'could not schedule'
    return NextResponse.json({ ok: false, error: msg }, { status: 400 })
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin')
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })

  const body = (await req.json().catch(() => ({}))) as { clinicId?: string }
  if (!body.clinicId)
    return NextResponse.json({ error: 'clinicId required' }, { status: 400 })

  await unscheduleStudioVideo(params.id, body.clinicId)
  return NextResponse.json({ ok: true })
}
