import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { setTrendSourceActive, deleteTrendSource } from '@/lib/trends/sources'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface PatchBody {
  clinicId?: string
  active?: boolean
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }
  let body: PatchBody
  try {
    body = (await req.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  if (!body.clinicId || typeof body.active !== 'boolean') {
    return NextResponse.json(
      { error: 'clinicId and active required' },
      { status: 400 }
    )
  }
  await setTrendSourceActive(params.id, body.clinicId, body.active)
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }
  const clinicId = new URL(req.url).searchParams.get('clinicId')
  if (!clinicId)
    return NextResponse.json({ error: 'clinicId required' }, { status: 400 })
  await deleteTrendSource(params.id, clinicId)
  return NextResponse.json({ ok: true })
}
