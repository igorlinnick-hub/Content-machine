import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { loadArsenalRow } from '@/lib/arsenal/store'
import { saveArsenalAsTemplate } from '@/lib/arsenal/template-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// "Save as template" snapshots the arsenal entry's beat structure
// into a row in script_templates. The arsenal entry continues to live
// independently — operator can keep iterating on it. The frozen
// template gets picked up by the writer the same way as the 6 seeded
// defaults, no extra wiring needed.

interface Body {
  clinicId?: string
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
  if (!clinicId) {
    return NextResponse.json({ error: 'clinicId required' }, { status: 400 })
  }
  const arsenal = await loadArsenalRow(params.id, clinicId)
  if (!arsenal) {
    return NextResponse.json({ error: 'arsenal not found' }, { status: 404 })
  }
  try {
    const template = await saveArsenalAsTemplate(arsenal)
    return NextResponse.json({ ok: true, template })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
