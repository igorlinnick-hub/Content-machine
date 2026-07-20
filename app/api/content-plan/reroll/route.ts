import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import { rerollTopic } from '@/lib/agents/planner'
import { disabledHttpResponse } from '@/lib/agents/disabled'
import type { ClinicProfile } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 60

// POST /api/content-plan/reroll
// Body: { topicId: string }
// Replaces ONE plan topic in place — same week, same theme/pillar, same
// position — with a freshly generated one that avoids everything else
// already in the plan. Status resets to 'pending' (the old post, if any,
// stays in the library; only the plan slot changes).
export async function POST(req: Request) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json({ error: 'admin required' }, { status: 403 })
  }
  const off = await disabledHttpResponse()
  if (off) return off

  const body = await req.json().catch(() => ({}))
  const topicId = typeof body.topicId === 'string' ? body.topicId : null
  if (!topicId) {
    return NextResponse.json({ error: 'topicId required' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data: topicRow, error: topicErr } = await supabase
    .from('content_plan_topics')
    .select('id, clinic_id, week_id, topic')
    .eq('id', topicId)
    .maybeSingle()
  if (topicErr || !topicRow || !topicRow.week_id) {
    return NextResponse.json(
      { error: topicErr?.message ?? 'topic not found' },
      { status: 404 }
    )
  }

  const [{ data: week }, { data: clinic }, { data: allTopics }] = await Promise.all([
    supabase
      .from('content_plan_weeks')
      .select('theme, pillar, description')
      .eq('id', topicRow.week_id)
      .maybeSingle(),
    supabase.from('clinics').select('*').eq('id', topicRow.clinic_id).maybeSingle(),
    supabase
      .from('content_plan_topics')
      .select('id, week_id, topic')
      .eq('clinic_id', topicRow.clinic_id),
  ])
  if (!week || !clinic) {
    return NextResponse.json({ error: 'week or clinic not found' }, { status: 404 })
  }

  const profile: ClinicProfile = {
    id: clinic.id,
    name: clinic.name,
    niche: clinic.niche ?? 'regenerative_medicine',
    social_handle:
      (clinic as unknown as { social_handle?: string | null }).social_handle ?? null,
    services: clinic.services ?? [],
    audience: clinic.audience ?? '',
    tone: (clinic.tone ?? 'educational') as ClinicProfile['tone'],
    doctor_name: clinic.doctor_name ?? '',
    medical_restrictions: clinic.medical_restrictions ?? [],
    content_pillars: clinic.content_pillars ?? [],
    deep_dive_topics: clinic.deep_dive_topics ?? [],
  }

  const siblings = (allTopics ?? []).filter(
    (t) => t.week_id === topicRow.week_id && t.id !== topicRow.id
  )
  const elsewhere = (allTopics ?? []).filter((t) => t.week_id !== topicRow.week_id)

  try {
    const fresh = await rerollTopic({
      profile,
      week: { theme: week.theme, pillar: week.pillar, description: week.description },
      keepTopics: siblings.map((t) => t.topic),
      rejectedTopic: topicRow.topic,
      avoidTopics: elsewhere.map((t) => t.topic).slice(0, 60),
    })

    const { error: updErr } = await supabase
      .from('content_plan_topics')
      .update({
        topic: fresh.topic,
        keyword: fresh.keyword,
        format: fresh.format,
        status: 'pending',
      })
      .eq('id', topicRow.id)
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      id: topicRow.id,
      topic: fresh.topic,
      keyword: fresh.keyword,
      format: fresh.format,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'reroll failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
