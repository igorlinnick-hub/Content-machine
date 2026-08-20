import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import { isKnownFormat } from '@/lib/posts/formats'

// POST /api/content-plan/set-format
// Body: { topicId: string, format: string | null }
//
// The marketer's format button (Igor 2026-08-19). The content plan owns WHAT a
// week talks about; this owns HOW that post is written. Writing the name onto
// content_plan_topics.format is enough — generate reads it back through
// getCurrentPlanContext and pins the matching scaffold for the Writer.
// `format: null` hands the choice back to the Writer.
export async function POST(req: Request) {
  const access = await resolveAccess()
  if (!access) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const topicId = typeof body.topicId === 'string' ? body.topicId : null
  const rawFormat = typeof body.format === 'string' ? body.format.trim() : null
  const format = rawFormat && rawFormat.length > 0 ? rawFormat : null

  if (!topicId) {
    return NextResponse.json({ error: 'topicId required' }, { status: 400 })
  }
  // Only names the Writer actually has a scaffold for — a typo here would
  // silently degrade to "Writer picks whatever it likes".
  if (format && !isKnownFormat(format)) {
    return NextResponse.json({ error: `unknown format: ${format}` }, { status: 400 })
  }

  const supabase = createServerClient()

  // A doctor's session may only touch its own clinic's plan.
  if (access.role !== 'admin') {
    const { data: owner } = await supabase
      .from('content_plan_topics')
      .select('clinic_id')
      .eq('id', topicId)
      .maybeSingle()
    if (!owner || owner.clinic_id !== access.clinicId) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
  }

  const { error } = await supabase
    .from('content_plan_topics')
    .update({ format } as never)
    .eq('id', topicId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, format })
}
