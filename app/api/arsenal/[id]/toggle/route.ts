import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import {
  confirmArsenalRow,
  deleteArsenalRow,
  loadArsenalRow,
  setArsenalActive,
} from '@/lib/arsenal/store'
import { deleteArsenalObjects } from '@/lib/arsenal/storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// One catch-all action endpoint to keep the surface small: confirm,
// on/off toggle, or hard delete. Keeps the front-end from juggling 3
// separate URLs for what is conceptually "lifecycle controls" on one
// arsenal row.

interface Body {
  clinicId?: string
  // 'confirm'   — flip is_active=true and stamp confirmed_at (used right
  //               after the draft lands, equivalent to "arsenal confirm <label>")
  // 'on'/'off'  — toggle is_active without touching confirmed_at
  // 'delete'    — hard delete + remove storage objects
  action?: 'confirm' | 'on' | 'off' | 'delete'
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
  if (!clinicId || !body.action) {
    return NextResponse.json(
      { error: 'clinicId and action required' },
      { status: 400 }
    )
  }
  if (body.action === 'confirm') {
    const row = await confirmArsenalRow(params.id, clinicId)
    if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json({ ok: true, row })
  }
  if (body.action === 'on' || body.action === 'off') {
    const row = await setArsenalActive(params.id, clinicId, body.action === 'on')
    if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json({ ok: true, row })
  }
  if (body.action === 'delete') {
    // Load first so we know which storage objects to remove.
    const existing = await loadArsenalRow(params.id, clinicId)
    const ok = await deleteArsenalRow(params.id, clinicId)
    if (!ok) return NextResponse.json({ error: 'delete failed' }, { status: 500 })
    if (existing) {
      // Storage cleanup is best-effort — a leftover blob does no harm
      // and shouldn't block the row delete from succeeding.
      void deleteArsenalObjects(
        existing.video_storage_path,
        existing.thumbnail_storage_path
      ).catch(() => {})
    }
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'invalid action' }, { status: 400 })
}
