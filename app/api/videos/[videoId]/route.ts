import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { deleteVideo, loadVideo } from '@/lib/videos/store'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  { params }: { params: { videoId: string } }
) {
  const access = await resolveAccess()
  if (!access) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const v = await loadVideo(params.videoId)
  if (!v) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (access.role !== 'admin' && v.clinic_id !== access.clinicId) {
    return NextResponse.json({ error: 'wrong clinic' }, { status: 403 })
  }
  return NextResponse.json(v)
}

export async function DELETE(
  _req: Request,
  { params }: { params: { videoId: string } }
) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }
  try {
    await deleteVideo(params.videoId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
