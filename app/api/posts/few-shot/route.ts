import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import {
  loadFewShotExamples,
  saveFewShotExample,
} from '@/lib/supabase/context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const access = await resolveAccess()
  return access && access.role === 'admin' ? access : null
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
    const examples = await loadFewShotExamples(clinicId)
    return NextResponse.json({ examples })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }
  let body: {
    clinicId?: string
    script_text?: string
    topic?: string
    why_good?: string
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  const clinicId = body.clinicId?.trim()
  const script_text = body.script_text?.trim()
  if (!clinicId || !script_text) {
    return NextResponse.json(
      { error: 'clinicId and script_text required' },
      { status: 400 }
    )
  }
  try {
    const example = await saveFewShotExample(clinicId, {
      script_text,
      topic: body.topic?.trim() || undefined,
      why_good: body.why_good?.trim() || undefined,
    })
    return NextResponse.json({ example })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
