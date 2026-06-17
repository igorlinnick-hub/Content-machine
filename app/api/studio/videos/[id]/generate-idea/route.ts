import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { disabledHttpResponse } from '@/lib/agents/disabled'
import { loadStudioVideo } from '@/lib/studio/videos'
import { generateAndPinIdea, loadStudioIdea } from '@/lib/studio/slots'

export const runtime = 'nodejs'
export const maxDuration = 120

// POST /api/studio/videos/<id>/generate-idea  { clinicId? }
// Generate (or regenerate) the shoot idea for a Shot List video and pin
// it. Open to the team. Regenerate diverges from the current hook.
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const access = await resolveAccess()
  if (!access) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const off = await disabledHttpResponse()
  if (off) return off

  const body = (await req.json().catch(() => ({}))) as {
    clinicId?: string
    note?: string
  }
  const clinicId = access.role === 'admin' ? body.clinicId : access.clinicId
  if (!clinicId)
    return NextResponse.json({ error: 'clinicId required' }, { status: 400 })

  const video = await loadStudioVideo(params.id, clinicId)
  if (!video)
    return NextResponse.json({ error: 'video not found' }, { status: 404 })

  // Steer a regenerate away from the current hook; honour an optional tweak.
  const previous = await loadStudioIdea(clinicId, video.current_script_id)
  const excludeHooks = previous?.hook ? [previous.hook] : []
  const steer = typeof body.note === 'string' ? body.note.slice(0, 300) : null

  try {
    const idea = await generateAndPinIdea(clinicId, video, { excludeHooks, steer })
    return NextResponse.json({ ok: true, idea })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
