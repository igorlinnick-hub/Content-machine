import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import { rerollTopic } from '@/lib/agents/planner'
import { disabledHttpResponse } from '@/lib/agents/disabled'
import type { ClinicProfile } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 60

// POST /api/content-plan/add-topic
// Body: { weekId: string }
// Generates ONE extra topic for the week (same theme/pillar, no
// collisions with the rest of the plan) and appends it after the
// existing topics.
export async function POST(req: Request) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json({ error: 'admin required' }, { status: 403 })
  }
  const off = await disabledHttpResponse()
  if (off) return off

  const body = await req.json().catch(() => ({}))
  const weekId = typeof body.weekId === 'string' ? body.weekId : null
  if (!weekId) {
    return NextResponse.json({ error: 'weekId required' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data: week, error: weekErr } = await supabase
    .from('content_plan_weeks')
    .select('id, clinic_id, theme, pillar, description')
    .eq('id', weekId)
    .maybeSingle()
  if (weekErr || !week) {
    return NextResponse.json(
      { error: weekErr?.message ?? 'week not found' },
      { status: 404 }
    )
  }

  const [{ data: clinic }, { data: allTopics }] = await Promise.all([
    supabase.from('clinics').select('*').eq('id', week.clinic_id).maybeSingle(),
    supabase
      .from('content_plan_topics')
      .select('id, week_id, topic, position')
      .eq('clinic_id', week.clinic_id),
  ])
  if (!clinic) {
    return NextResponse.json({ error: 'clinic not found' }, { status: 404 })
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

  const inWeek = (allTopics ?? []).filter((t) => t.week_id === weekId)
  const elsewhere = (allTopics ?? []).filter((t) => t.week_id !== weekId)

  try {
    const fresh = await rerollTopic({
      profile,
      week: { theme: week.theme, pillar: week.pillar, description: week.description },
      keepTopics: inWeek.map((t) => t.topic),
      avoidTopics: elsewhere.map((t) => t.topic).slice(0, 60),
    })

    const position =
      inWeek.length > 0 ? Math.max(...inWeek.map((t) => t.position ?? 0)) + 1 : 0
    const { data: inserted, error: insErr } = await supabase
      .from('content_plan_topics')
      .insert({
        clinic_id: week.clinic_id,
        week_id: weekId,
        topic: fresh.topic,
        keyword: fresh.keyword,
        format: fresh.format,
        position,
        status: 'pending',
      })
      .select('id')
      .single()
    if (insErr || !inserted) {
      return NextResponse.json(
        { error: insErr?.message ?? 'insert failed' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      id: inserted.id,
      topic: fresh.topic,
      keyword: fresh.keyword,
      format: fresh.format,
      position,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'add-topic failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
