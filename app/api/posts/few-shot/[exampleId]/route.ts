import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import {
  deactivateFewShotExample,
  setFewShotPin,
} from '@/lib/supabase/context'

export const runtime = 'nodejs'

async function requireAdmin() {
  const access = await resolveAccess()
  return access && access.role === 'admin' ? access : null
}

export async function DELETE(
  _req: Request,
  { params }: { params: { exampleId: string } }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }
  try {
    await deactivateFewShotExample(params.exampleId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { exampleId: string } }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }
  let body: { pinned?: unknown }
  try {
    body = (await req.json()) as { pinned?: unknown }
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  if (typeof body.pinned !== 'boolean') {
    return NextResponse.json({ error: 'pinned (boolean) required' }, { status: 400 })
  }
  try {
    await setFewShotPin(params.exampleId, body.pinned)
    return NextResponse.json({ ok: true, pinned: body.pinned })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
