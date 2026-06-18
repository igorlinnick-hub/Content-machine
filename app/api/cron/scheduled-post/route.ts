import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { llmAgentsEnabled } from '@/lib/agents/disabled'
import { checkCronAuth, pickNextPlanForClinic } from '@/lib/posts/pipeline'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Each generate call is ~60-180s; we cap at 1 clinic per tick so we
// never run multiple writers in parallel inside the cron lambda.
export const maxDuration = 300

// HANDOFF-POSTS.md §22.4 — Cron entry for scheduled post generation.
//
// Schedule (vercel.json): "0 19 * * 1,3,5" = Mon/Wed/Fri 19:00 UTC =
// 09:00 HST. For each active clinic with a non-empty content_plan
// rotation, pick the smallest cycle_position whose plan_handle is not
// yet on a ready_for_canva / in_canva / published slide_set, then call
// POST /api/posts/generate with that plan_handle.
//
// Auth: standard Vercel cron — Authorization: Bearer ${CRON_SECRET}.
//
// Output (cron tick summary):
//   { generated: N, blocked: M, skipped: K, errors: [{clinicId, error}] }

export async function GET(req: Request) {
  if (!checkCronAuth(req)) {
    return NextResponse.json({ error: 'cron auth required' }, { status: 401 })
  }
  if (!llmAgentsEnabled()) {
    // Subscription mode — pipeline is off, cron is a no-op.
    return NextResponse.json({
      ok: true,
      message: 'LLM agents disabled — cron skipped',
      generated: 0,
      blocked: 0,
      skipped: 0,
    })
  }

  const supabase = createServerClient()

  // Active clinics — anything with at least one content_plan_topics row
  // that has cycle_position set. (We deliberately do NOT iterate every
  // clinic just because it exists.)
  const { data: rows, error } = await supabase
    .from('content_plan_topics')
    .select('clinic_id')
    .not('cycle_position', 'is', null)
  if (error) {
    return NextResponse.json(
      { error: `clinics lookup failed: ${error.message}` },
      { status: 500 }
    )
  }
  const clinicIds = Array.from(
    new Set(
      (rows ?? [])
        .map((r) => (r as { clinic_id?: string | null }).clinic_id)
        .filter((c): c is string => typeof c === 'string' && c.length > 0)
    )
  )

  if (clinicIds.length === 0) {
    return NextResponse.json({
      ok: true,
      message: 'no clinics with active content plan rotation',
      generated: 0,
      blocked: 0,
      skipped: 0,
    })
  }

  const serviceToken = process.env.SERVICE_TOKEN
  if (!serviceToken) {
    return NextResponse.json(
      {
        error:
          'SERVICE_TOKEN not configured — cron cannot call /api/posts/generate',
      },
      { status: 500 }
    )
  }

  // Resolve the public origin for the internal API call. Vercel sets
  // VERCEL_URL on every deployment. Fall back to the request's origin.
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    new URL(req.url).origin

  let generated = 0
  let blocked = 0
  let skipped = 0
  const errors: { clinicId: string; error: string }[] = []

  for (const clinicId of clinicIds) {
    try {
      const next = await pickNextPlanForClinic(clinicId)
      if (!next) {
        skipped += 1
        continue
      }
      const res = await fetch(`${origin}/api/posts/generate`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${serviceToken}`,
        },
        body: JSON.stringify({
          clinicId,
          planId: next.plan_handle,
          length: 'short',
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        slide_set_id?: string | null
        error?: string
      }
      if (!res.ok) {
        errors.push({
          clinicId,
          error: data?.error ?? `HTTP ${res.status}`,
        })
        continue
      }
      // We don't know the verdict here without another DB lookup; the
      // pipeline already wrote the right status. Count generated rows
      // and let blocked/ready_for_canva differentiation come from the
      // /ready-for-canva poll on the consumer side.
      if (data.slide_set_id) {
        generated += 1
      } else {
        skipped += 1
      }
    } catch (e) {
      errors.push({
        clinicId,
        error: e instanceof Error ? e.message : 'unknown',
      })
    }
  }

  return NextResponse.json({
    ok: true,
    generated,
    blocked,
    skipped,
    errors: errors.slice(0, 10),
  })
}
