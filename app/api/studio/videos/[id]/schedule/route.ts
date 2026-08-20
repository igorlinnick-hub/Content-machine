import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { scheduleStudioVideo, unscheduleStudioVideo } from '@/lib/studio/schedule'
import { loadStudioVideo } from '@/lib/studio/videos'
import { loadStudioIdea } from '@/lib/studio/slots'

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

  // Same rule as the add route: the MA board drops briefs the compliance
  // gate blocked (and ungraded ones), so booking a day for one would burn
  // the slot and show the MAs nothing. Refuse loudly instead.
  const video = await loadStudioVideo(params.id, body.clinicId)
  if (!video)
    return NextResponse.json({ ok: false, error: 'video not found' }, { status: 404 })
  const idea = await loadStudioIdea(body.clinicId, video.current_script_id)
  if (!idea)
    return NextResponse.json(
      { ok: false, error: 'Generate the shoot brief first — the MA board needs it.' },
      { status: 400 }
    )
  if (idea.blocked)
    return NextResponse.json(
      {
        ok: false,
        error: idea.compliance
          ? `Compliance returned ${idea.compliance.grade} — regenerate the brief before scheduling.`
          : 'This brief was never graded. Regenerate it before scheduling.',
      },
      { status: 400 }
    )

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
