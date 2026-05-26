import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { resolveAccess } from '@/lib/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Admin clinic profile editor. /api/onboarding.PATCH is doctor-scoped
// (a doctor cookie can only ever edit its own clinic). This route lets
// an admin update ANY clinic by id — used by the /clinics hub for
// inline profile edits. Doctors hitting this get 403.

interface PatchBody {
  name?: string
  doctor_name?: string | null
  niche?: string | null
  services?: string[]
  audience?: string | null
  tone?: string | null
  medical_restrictions?: string[]
  content_pillars?: string[]
  deep_dive_topics?: string[]
}

interface Ctx {
  params: { clinicId: string }
}

function sanitizeList(input: string[] | undefined): string[] | undefined {
  if (!Array.isArray(input)) return undefined
  return input
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter((s) => s.length > 0)
}

export async function PATCH(req: Request, { params }: Ctx) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json(
      { error: 'admin access required' },
      { status: 403 }
    )
  }
  let body: PatchBody
  try {
    body = (await req.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }
  const patch: Record<string, unknown> = {}
  if (body.name !== undefined) patch.name = body.name.trim()
  if (body.doctor_name !== undefined)
    patch.doctor_name = body.doctor_name?.trim() || null
  if (body.niche !== undefined) patch.niche = body.niche?.trim() || null
  if (body.audience !== undefined)
    patch.audience = body.audience?.trim() || null
  if (body.tone !== undefined) patch.tone = body.tone?.trim() || null
  const services = sanitizeList(body.services)
  if (services !== undefined) patch.services = services
  const med = sanitizeList(body.medical_restrictions)
  if (med !== undefined) patch.medical_restrictions = med
  const pillars = sanitizeList(body.content_pillars)
  if (pillars !== undefined) patch.content_pillars = pillars
  const deepDive = sanitizeList(body.deep_dive_topics)
  if (deepDive !== undefined) patch.deep_dive_topics = deepDive

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
  }

  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('clinics')
      .update(patch)
      .eq('id', params.clinicId)
      .select('*')
      .single()
    if (error || !data) {
      throw error ?? new Error('update returned no row')
    }
    return NextResponse.json({ clinic: data })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
