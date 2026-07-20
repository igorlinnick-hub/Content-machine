import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'

// POST /api/content-plan/skip
// Body: { weekId: string }
// Marks the week as skipped so it's hidden from the plan UI and rotation.
// Undo: PATCH with { skipped: false } or regenerate the plan.
export async function POST(req: Request) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json({ error: 'admin required' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const weekId = typeof body.weekId === 'string' ? body.weekId : null
  if (!weekId) {
    return NextResponse.json({ error: 'weekId required' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { error } = await supabase
    .from('content_plan_weeks')
    .update({ skipped: true } as never)
    .eq('id', weekId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
