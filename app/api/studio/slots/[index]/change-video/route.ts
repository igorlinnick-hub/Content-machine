import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { disabledHttpResponse } from '@/lib/agents/disabled'
import { loadStudioVideo, pickNextStudioVideo } from '@/lib/studio/videos'
import {
  loadSlotRows,
  hydrateColumn,
  generateIdeaForVideo,
  setSlotVideo,
} from '@/lib/studio/slots'

export const runtime = 'nodejs'
export const maxDuration = 120

// POST /api/studio/slots/<index>/change-video
// Swaps this column to the next video from the clinic's curated base
// (not already on the board) and regenerates schema + template + idea.
// Other columns are untouched. Doctor + admin.
export async function POST(
  req: Request,
  { params }: { params: { index: string } }
) {
  const access = await resolveAccess()
  if (!access) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const off = await disabledHttpResponse()
  if (off) return off

  let clinicId: string
  if (access.role === 'admin') {
    const body = (await req.json().catch(() => ({}))) as { clinicId?: string }
    if (!body.clinicId)
      return NextResponse.json({ error: 'clinicId required' }, { status: 400 })
    clinicId = body.clinicId
  } else {
    clinicId = access.clinicId
  }

  const slotIndex = Number.parseInt(params.index, 10)
  if (Number.isNaN(slotIndex))
    return NextResponse.json({ error: 'bad slot index' }, { status: 400 })

  const slots = await loadSlotRows(clinicId)
  const slot = slots.find((s) => s.slot_index === slotIndex)
  if (!slot) return NextResponse.json({ error: 'slot not found' }, { status: 404 })

  // Exclude every video currently on the board (this slot included).
  const exclude = slots
    .map((s) => s.studio_video_id)
    .filter((id): id is string => Boolean(id))

  const pick = await pickNextStudioVideo(clinicId, { exclude })
  if (!pick)
    return NextResponse.json(
      { ok: false, error: 'no other videos in the base yet' },
      { status: 409 }
    )

  const video = await loadStudioVideo(pick.videoId, clinicId)
  if (!video)
    return NextResponse.json({ error: 'studio video not found' }, { status: 404 })

  try {
    const idea = await generateIdeaForVideo(clinicId, video)
    await setSlotVideo(clinicId, slotIndex, pick.videoId, idea.script_id)
    const column = await hydrateColumn(
      clinicId,
      { slot_index: slotIndex, studio_video_id: pick.videoId, current_script_id: idea.script_id },
      idea
    )
    return NextResponse.json({ ok: true, column })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
