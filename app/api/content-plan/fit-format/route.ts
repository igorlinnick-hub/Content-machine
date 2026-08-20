import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import { fitTopicToFormat } from '@/lib/agents/planner'
import { disabledHttpResponse } from '@/lib/agents/disabled'
import { isKnownFormat } from '@/lib/posts/formats'
import type { ClinicProfile } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 60

// POST /api/content-plan/fit-format
// Body: { topicId: string, format?: string }            — plan topic (persisted)
//   or: { clinicId: string, topic: string, format: string } — ad-hoc (not persisted)
//
// The opt-in half of the format button (Igor 2026-08-20). Pressing a format
// never rewrites the plan's topic line on its own — the 8-week arc hangs on
// that line and a silent rewrite is invisible to the marketer. This endpoint
// is what the explicit "Fit topic" button calls: same subject, rephrased for
// the format, returned so the marketer can edit or undo it before generating.
// `previousTopic` comes back so the UI can offer that undo.
export async function POST(req: Request) {
  const access = await resolveAccess()
  if (!access) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const off = await disabledHttpResponse()
  if (off) return off

  const body = await req.json().catch(() => ({}))
  const topicId = typeof body.topicId === 'string' ? body.topicId : null
  const rawFormat = typeof body.format === 'string' ? body.format.trim() : null
  const adHocTopic = typeof body.topic === 'string' ? body.topic.trim() : null
  const bodyClinicId = typeof body.clinicId === 'string' ? body.clinicId : null

  if (rawFormat && !isKnownFormat(rawFormat)) {
    return NextResponse.json({ error: `unknown format: ${rawFormat}` }, { status: 400 })
  }
  if (!topicId && (!adHocTopic || !rawFormat)) {
    return NextResponse.json(
      { error: 'topicId, or topic + format, required' },
      { status: 400 }
    )
  }

  const supabase = createServerClient()

  // ── Resolve what we are rewriting, and who owns it ──────────────
  let clinicId: string
  let currentTopic: string
  let format: string
  let weekId: string | null = null

  if (topicId) {
    const { data: row, error } = await supabase
      .from('content_plan_topics')
      .select('id, clinic_id, week_id, topic, format')
      .eq('id', topicId)
      .maybeSingle()
    if (error || !row) {
      return NextResponse.json(
        { error: error?.message ?? 'topic not found' },
        { status: 404 }
      )
    }
    // The format may still be in flight client-side (the button writes it
    // through set-format in parallel), so the body wins over the stored one.
    const resolved = rawFormat ?? (row.format as string | null)
    if (!resolved) {
      return NextResponse.json({ error: 'no format on this topic' }, { status: 400 })
    }
    clinicId = row.clinic_id
    currentTopic = row.topic
    format = resolved
    weekId = row.week_id
  } else {
    clinicId = bodyClinicId ?? (access.role === 'admin' ? '' : access.clinicId)
    currentTopic = adHocTopic!
    format = rawFormat!
    if (!clinicId) {
      return NextResponse.json({ error: 'clinicId required' }, { status: 400 })
    }
  }

  if (access.role !== 'admin' && clinicId !== access.clinicId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const [{ data: clinic }, { data: week }, { data: allTopics }] = await Promise.all([
    supabase.from('clinics').select('*').eq('id', clinicId).maybeSingle(),
    weekId
      ? supabase
          .from('content_plan_weeks')
          .select('theme, pillar, description')
          .eq('id', weekId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('content_plan_topics').select('id, topic').eq('clinic_id', clinicId),
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

  try {
    const fitted = await fitTopicToFormat({
      profile,
      week: week ?? null,
      currentTopic,
      format,
      avoidTopics: (allTopics ?? [])
        .filter((t) => t.id !== topicId)
        .map((t) => t.topic)
        .slice(0, 60),
    })
    const nextTopic = (fitted?.topic ?? '').trim()
    if (!nextTopic) {
      return NextResponse.json({ error: 'empty rewrite' }, { status: 500 })
    }

    // Plan topics persist so the rewrite survives a reload; ad-hoc text
    // lives only in the marketer's input box.
    if (topicId && nextTopic !== currentTopic) {
      const { error: updErr } = await supabase
        .from('content_plan_topics')
        .update({ topic: nextTopic } as never)
        .eq('id', topicId)
      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 500 })
      }
    }

    return NextResponse.json({
      ok: true,
      id: topicId,
      topic: nextTopic,
      previousTopic: currentTopic,
      changed: nextTopic !== currentTopic,
      format,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'fit failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
