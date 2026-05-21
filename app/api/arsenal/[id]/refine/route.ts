import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { setPendingRefineNote } from '@/lib/arsenal/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Admin types "разверни про b-roll подробнее" → we write the note
// onto the arsenal row. The local skill polls /api/arsenal/refine-queue,
// reads the note, regenerates the affected fields, then POSTs to
// /api/arsenal/[id]/apply-refinement to clear the note + stamp history.

interface Body {
  clinicId?: string
  note?: string
}

interface RouteContext {
  params: { id: string }
}

export async function POST(req: Request, { params }: RouteContext) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  const clinicId = body.clinicId?.trim()
  const note = body.note?.trim()
  if (!clinicId || !note) {
    return NextResponse.json(
      { error: 'clinicId and non-empty note required' },
      { status: 400 }
    )
  }
  const row = await setPendingRefineNote(params.id, clinicId, note)
  if (!row) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  return NextResponse.json({ ok: true, row })
}
