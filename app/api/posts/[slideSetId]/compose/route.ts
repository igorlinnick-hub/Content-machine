import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import { canCompose } from '@/lib/posts/status-owners'
import { pingCanvaRunner } from '@/lib/posts/ping-canva-runner'
import { composeInCanva, ComposeError } from '@/lib/canva/orchestrator'
import { canvaIsConfigured } from '@/lib/canva/oauth'
import { autofillIsConfigured } from '@/lib/canva/template-map'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Flux × 4-6 + asset uploads + Canva autofill poll → keep generous headroom.
export const maxDuration = 300

// Compose a slide_set's PostPlan into a finished Canva design.
//
// Two paths, picked at request time based on env config:
//
//   1. INLINE PATH (canvaIsConfigured + autofillIsConfigured):
//      Flip status='in_canva', then run the full Canva pipeline
//      synchronously: Flux photos → Canva upload → autofill brand
//      template. On success: write render_result + status='visuals_ready'.
//      On failure: revert status to 'review' (don't strand the row in
//      'in_canva' on a transient error) and surface the message.
//      Returns the render_result JSON.
//
//   2. QUEUE PATH (env vars missing):
//      Flip status='ready_for_canva' and send a Telegram ping so an
//      external runner can pick it up. Returns immediately with the
//      queue status. This was the only path until the orchestrator
//      landed; we keep it so partial config still does something
//      useful instead of failing the request.
//
// Both paths refuse 'blocked' posts (compliance violations) and any
// status that canCompose() rejects.
export async function POST(
  req: Request,
  { params }: { params: { slideSetId: string } }
) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }

  const supabase = createServerClient()

  const { data: row, error: loadErr } = await supabase
    .from('slide_sets')
    .select('id, clinic_id, status, scripts ( topic )')
    .eq('id', params.slideSetId)
    .maybeSingle()
  if (loadErr || !row) {
    return NextResponse.json(
      { error: `slide_set not found: ${loadErr?.message ?? 'no row'}` },
      { status: 404 }
    )
  }
  if (row.status === 'blocked') {
    return NextResponse.json(
      { error: 'cannot compose a blocked post — fix compliance findings first' },
      { status: 409 }
    )
  }
  if (!canCompose(row.status)) {
    return NextResponse.json(
      { error: `cannot compose from status='${row.status}'` },
      { status: 409 }
    )
  }

  const inlineMode = canvaIsConfigured() && autofillIsConfigured()

  // ── QUEUE PATH ──────────────────────────────────────────────────
  if (!inlineMode) {
    const { error: updErr } = await supabase
      .from('slide_sets')
      .update({ status: 'ready_for_canva' })
      .eq('id', params.slideSetId)
    if (updErr) {
      return NextResponse.json(
        { error: `queue failed: ${updErr.message}` },
        { status: 500 }
      )
    }

    const url = new URL(req.url)
    const scripts = Array.isArray(row.scripts) ? row.scripts[0] : row.scripts
    const topic = (scripts as { topic?: string | null } | null | undefined)?.topic ?? null
    void pingCanvaRunner({
      slideSetId: params.slideSetId,
      clinicId: row.clinic_id ?? '',
      topic,
      origin: url.origin,
    })

    return NextResponse.json({
      ok: true,
      mode: 'queue',
      slide_set_id: params.slideSetId,
      status: 'ready_for_canva',
    })
  }

  // ── INLINE PATH ─────────────────────────────────────────────────
  // Atomic claim — only flip to in_canva if we're still in a
  // composable state. Two clicks from different tabs can't double-fire.
  const { data: claimed, error: claimErr } = await supabase
    .from('slide_sets')
    .update({ status: 'in_canva' })
    .eq('id', params.slideSetId)
    .in('status', [
      'review',
      'ready_for_canva',
      'visuals_ready',
      'approved',
      'rendered',
      'exported',
    ])
    .select('id')
    .maybeSingle()
  if (claimErr) {
    return NextResponse.json(
      { error: `claim failed: ${claimErr.message}` },
      { status: 500 }
    )
  }
  if (!claimed) {
    return NextResponse.json(
      { error: 'another compose is already running for this post' },
      { status: 409 }
    )
  }

  try {
    const result = await composeInCanva({ slideSetId: params.slideSetId })
    return NextResponse.json({
      ok: true,
      mode: 'inline',
      slide_set_id: params.slideSetId,
      status: 'visuals_ready',
      render_result: result,
    })
  } catch (e) {
    // Roll the row back to 'review' so the marketer can see a clear
    // state instead of a permanently-in-canva ghost. Surface the
    // hint when it's a config error so they know what to fix.
    await supabase
      .from('slide_sets')
      .update({ status: 'review' })
      .eq('id', params.slideSetId)

    const isComposeErr = e instanceof ComposeError
    const msg = e instanceof Error ? e.message : 'compose failed'
    return NextResponse.json(
      {
        error: msg,
        hint: isComposeErr ? e.hint ?? null : null,
      },
      { status: 500 }
    )
  }
}
