import { waitUntil } from '@vercel/functions'
import { resolveAccess } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import { runPlanner } from '@/lib/agents/planner'
import { replaceStructuredPlan } from '@/lib/content-plan/store'
import { getPublishedPosts, buildPublishedContext } from '@/lib/hellometrix/published-posts'
import type { ClinicProfile } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: Request) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return Response.json({ error: 'admin required' }, { status: 403 })
  }

  let body: { clinicId: string }
  try {
    body = (await req.json()) as { clinicId: string }
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const clinicId = body.clinicId?.trim()
  if (!clinicId) return Response.json({ error: 'clinicId required' }, { status: 400 })

  const supabase = createServerClient()
  const { data: clinic, error: clinicErr } = await supabase
    .from('clinics')
    .select('*')
    .eq('id', clinicId)
    .single()

  if (clinicErr || !clinic) {
    return Response.json({ error: 'clinic not found' }, { status: 404 })
  }

  // Mark as generating immediately so the client can start polling
  await supabase
    .from('clinics')
    .update({ plan_status: 'generating', plan_error: null })
    .eq('id', clinicId)

  const profile: ClinicProfile = {
    id: clinic.id,
    name: clinic.name,
    niche: clinic.niche ?? 'regenerative_medicine',
    social_handle: (clinic as unknown as { social_handle?: string | null }).social_handle ?? null,
    services: clinic.services ?? [],
    audience: clinic.audience ?? '',
    tone: (clinic.tone ?? 'educational') as ClinicProfile['tone'],
    doctor_name: clinic.doctor_name ?? '',
    medical_restrictions: clinic.medical_restrictions ?? [],
    content_pillars: clinic.content_pillars ?? [],
    deep_dive_topics: clinic.deep_dive_topics ?? [],
  }

  // Run generation in background — keeps going even if client disconnects
  waitUntil(
    (async () => {
      try {
        const publishedPosts = await getPublishedPosts(clinicId)
        const publishedContext = buildPublishedContext(publishedPosts)

        const plan = await runPlanner(profile, { publishedContext: publishedContext || undefined })
        await replaceStructuredPlan(clinicId, plan.weeks)

        if (!clinic.content_plan_start) {
          await supabase
            .from('clinics')
            .update({ content_plan_start: new Date().toISOString().slice(0, 10) })
            .eq('id', clinicId)
        }

        await supabase
          .from('clinics')
          .update({ plan_status: null, plan_error: null })
          .eq('id', clinicId)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown error'
        await supabase
          .from('clinics')
          .update({ plan_status: 'error', plan_error: msg })
          .eq('id', clinicId)
      }
    })()
  )

  // Return immediately — client polls /api/content-plan/status
  return Response.json({ ok: true, status: 'generating' }, { status: 202 })
}
