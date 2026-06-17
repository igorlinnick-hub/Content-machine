import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { disabledHttpResponse } from '@/lib/agents/disabled'
import { addStudioVideoByUrl } from '@/lib/studio/addByUrl'
import { loadStudioVideo } from '@/lib/studio/videos'
import { generateAndPinIdea } from '@/lib/studio/slots'

export const runtime = 'nodejs'
export const maxDuration = 180

// POST /api/studio/videos/add  { clinicId?, url }  — ADMIN only.
// Paste a TikTok link → Apify ingests it → lands straight on the Shot List
// with a generated shoot idea. Same engine as everything else.
export async function POST(req: Request) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin')
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })

  const body = (await req.json().catch(() => ({}))) as {
    clinicId?: string
    url?: string
  }
  const clinicId = body.clinicId
  const url = body.url?.trim()
  if (!clinicId || !url)
    return NextResponse.json({ error: 'clinicId and url required' }, { status: 400 })

  let added: { id: string }
  try {
    added = await addStudioVideoByUrl({ clinicId, url, status: 'shotlist' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json({ ok: false, error: msg }, { status: 400 })
  }

  // Best-effort idea generation (respects the kill switch). The video is
  // already on the Shot List even if generation is off.
  const off = await disabledHttpResponse()
  if (!off) {
    try {
      const video = await loadStudioVideo(added.id, clinicId)
      if (video) await generateAndPinIdea(clinicId, video)
    } catch {
      /* video is on the board; idea can be generated from the card later */
    }
  }

  return NextResponse.json({ ok: true, id: added.id })
}
