import { NextResponse } from 'next/server'
import {
  applyRefinement,
  type ApplyRefinementInput,
  type ArsenalHook,
  type ArsenalStructure,
  type ArsenalVisualNotes,
} from '@/lib/arsenal/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Skill calls this once it has re-extracted the requested fields.
// Body shape matches ApplyRefinementInput — every field optional, so a
// "разверни про b-roll" refinement can update only visual_notes
// without touching hooks/structure.

function checkSecret(req: Request): boolean {
  const expected = process.env.CONTENT_MACHINE_SECRET
  if (!expected) return false
  return req.headers.get('x-internal-dispatch-secret') === expected
}

interface Body extends ApplyRefinementInput {
  clinic_id?: string
}

interface RouteContext {
  params: { id: string }
}

export async function POST(req: Request, { params }: RouteContext) {
  if (!checkSecret(req)) {
    return NextResponse.json({ error: 'invalid secret' }, { status: 401 })
  }
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  const clinicId = body.clinic_id?.trim()
  if (!clinicId) {
    return NextResponse.json({ error: 'clinic_id required' }, { status: 400 })
  }
  try {
    const row = await applyRefinement(params.id, clinicId, {
      styleDescription: body.styleDescription ?? undefined,
      hooks: body.hooks as ArsenalHook[] | undefined,
      structure: body.structure as ArsenalStructure | undefined,
      pains: body.pains as string[] | undefined,
      visualNotes: body.visualNotes as ArsenalVisualNotes | undefined,
      summary: body.summary ?? null,
    })
    if (!row) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, row })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
