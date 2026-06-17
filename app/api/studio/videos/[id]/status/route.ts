import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import {
  setStudioStatus,
  loadStudioVideo,
  type StudioStatus,
} from '@/lib/studio/videos'

export const runtime = 'nodejs'

const VALID: StudioStatus[] = ['candidate', 'liked', 'shotlist', 'rejected']

// POST /api/studio/videos/<id>/status  { clinicId?, status }
// Funnel transitions. Liking / skipping (-> liked / rejected / candidate)
// is open to the whole team. Promoting to (or out of) the Shot List is
// ADMIN-ONLY — the boss's final pick.
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const access = await resolveAccess()
  if (!access) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as {
    clinicId?: string
    status?: string
  }
  const status = body.status as StudioStatus
  if (!VALID.includes(status))
    return NextResponse.json({ error: 'bad status' }, { status: 400 })

  const clinicId = access.role === 'admin' ? body.clinicId : access.clinicId
  if (!clinicId)
    return NextResponse.json({ error: 'clinicId required' }, { status: 400 })

  // The Shot List is admin-controlled: promoting TO it, or moving a video
  // already ON it, both require admin. Likes / skips stay open to all.
  if (access.role !== 'admin') {
    const current = await loadStudioVideo(params.id, clinicId)
    const touchesShotList = status === 'shotlist' || current?.status === 'shotlist'
    if (touchesShotList)
      return NextResponse.json(
        { error: 'only an admin can change the Shot List' },
        { status: 403 }
      )
  }

  await setStudioStatus(params.id, clinicId, status)
  return NextResponse.json({ ok: true, status })
}
