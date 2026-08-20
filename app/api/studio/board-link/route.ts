import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { ensureShootBoardToken, rotateShootBoardToken } from '@/lib/studio/schedule'

export const runtime = 'nodejs'

// POST /api/studio/board-link  { clinicId, rotate? }  — ADMIN only.
// Mints (or re-mints) the read-only link the MAs open. Idempotent unless
// rotate:true, which invalidates the old one — for when someone leaves.
export async function POST(req: Request) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin')
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })

  const body = (await req.json().catch(() => ({}))) as {
    clinicId?: string
    rotate?: boolean
  }
  if (!body.clinicId)
    return NextResponse.json({ error: 'clinicId required' }, { status: 400 })

  try {
    const token = body.rotate
      ? await rotateShootBoardToken(body.clinicId)
      : await ensureShootBoardToken(body.clinicId)
    return NextResponse.json({ ok: true, token, path: `/shoot/${token}` })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'could not mint link'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
