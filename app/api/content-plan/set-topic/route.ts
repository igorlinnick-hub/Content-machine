import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'

// POST /api/content-plan/set-topic
// Body: { topicId: string, topic: string }
//
// Writes a topic line back onto a plan row. No model call — this is the undo
// path for "Fit topic" (`/api/content-plan/fit-format`), which persists its
// rewrite so it survives a reload; undoing it has to persist too, or the old
// line would come back on the next load and the marketer would be looking at
// text they thought they had restored.
export async function POST(req: Request) {
  const access = await resolveAccess()
  if (!access) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const topicId = typeof body.topicId === 'string' ? body.topicId : null
  const topic = typeof body.topic === 'string' ? body.topic.trim() : ''

  if (!topicId || !topic) {
    return NextResponse.json({ error: 'topicId and topic required' }, { status: 400 })
  }

  const supabase = createServerClient()

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
    .update({ topic } as never)
    .eq('id', topicId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, topic })
}
