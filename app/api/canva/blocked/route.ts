import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { sendPushToClinic } from '@/lib/push/send'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// "Composing is paused" web-push ping, called by the local canva-runner
// poller (scripts/canva-runner/run.sh) when a pre-flight check parks the
// queue — lapsed Canva token, exhausted Replicate credit, Claude quota
// cooldown.
//
// Why this exists: the block reason used to live ONLY in the yellow banner
// on /visual, so a lapsed Canva token was invisible until someone happened
// to open the page — the post sat "Queued" for hours (Igor 2026-08-24, the
// token expired mid-compose at 12:18 and nothing said so). Push turns that
// into a phone notification within one tick.
//
// The runner dedupes: it posts here only when the reason CHANGES, so a
// two-minute poll does not become a two-minute notification loop.
//
// Auth: CONTENT_MACHINE_SECRET on x-internal-dispatch-secret, same as the
// arsenal skill endpoints.

function checkSecret(req: Request): boolean {
  const expected = process.env.CONTENT_MACHINE_SECRET
  if (!expected) return false
  return req.headers.get('x-internal-dispatch-secret') === expected
}

export async function POST(req: Request) {
  if (!checkSecret(req)) {
    return NextResponse.json({ error: 'invalid secret' }, { status: 401 })
  }

  let reason = ''
  try {
    const body = (await req.json()) as { reason?: unknown }
    reason = typeof body.reason === 'string' ? body.reason.trim() : ''
  } catch {
    reason = ''
  }
  if (!reason) {
    return NextResponse.json({ error: 'reason required' }, { status: 400 })
  }

  try {
    // Notify only the clinics that actually have a post stuck in the queue.
    const supabase = createServerClient()
    const { data: rows, error } = await supabase
      .from('slide_sets')
      .select('clinic_id')
      .eq('status', 'ready_for_canva')
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    const clinicIds = Array.from(
      new Set((rows ?? []).map((r) => r.clinic_id as string).filter(Boolean))
    )

    let sent = 0
    for (const clinicId of clinicIds) {
      sent += await sendPushToClinic(clinicId, {
        title: 'Composing is paused',
        body: reason,
        url: '/visual',
      })
    }
    return NextResponse.json({ ok: true, clinics: clinicIds.length, sent })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
