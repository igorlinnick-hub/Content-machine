import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { deletePost } from '@/lib/visual/store'

export const runtime = 'nodejs'

export async function DELETE(
  _req: Request,
  { params }: { params: { slideSetId: string } }
) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }
  try {
    await deletePost(params.slideSetId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
