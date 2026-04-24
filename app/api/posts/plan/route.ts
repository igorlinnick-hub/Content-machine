import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { loadPlan, replacePlan } from '@/lib/posts/plan'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return null
  }
  return access
}

export async function GET(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }
  const url = new URL(req.url)
  const clinicId = url.searchParams.get('clinicId')
  if (!clinicId) {
    return NextResponse.json({ error: 'clinicId required' }, { status: 400 })
  }
  try {
    const topics = await loadPlan(clinicId)
    return NextResponse.json({ topics })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }
  let body: { clinicId?: string; topics?: unknown }
  try {
    body = (await req.json()) as { clinicId?: string; topics?: unknown }
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  const clinicId = body.clinicId?.trim()
  if (!clinicId) {
    return NextResponse.json({ error: 'clinicId required' }, { status: 400 })
  }
  if (!Array.isArray(body.topics)) {
    return NextResponse.json({ error: 'topics must be an array' }, { status: 400 })
  }
  const list = body.topics
    .filter((t): t is string => typeof t === 'string')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
  try {
    const topics = await replacePlan(clinicId, list)
    return NextResponse.json({ topics })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
