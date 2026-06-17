import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { deleteStudioVideo } from '@/lib/studio/videos'

export const runtime = 'nodejs'

// DELETE /api/studio/videos/<id>?clinicId=...  — admin only.
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin')
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  const clinicId = new URL(req.url).searchParams.get('clinicId')
  if (!clinicId)
    return NextResponse.json({ error: 'clinicId required' }, { status: 400 })
  await deleteStudioVideo(params.id, clinicId)
  return NextResponse.json({ ok: true })
}
