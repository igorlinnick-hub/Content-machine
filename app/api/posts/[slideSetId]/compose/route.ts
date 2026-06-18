import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import { canCompose } from '@/lib/posts/status-owners'
import { pingCanvaRunner } from '@/lib/posts/ping-canva-runner'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Queues a slide_set for the Canva runner.
//
// Contract (2026-06-17, locked with the runner spec):
//   • Endpoint flips the row to status='ready_for_canva' atomically.
//   • Runner polls /api/posts/ready-for-canva (Bearer SERVICE_TOKEN)
//     OR receives the Telegram ping we send right after, picks a row,
//     and does its own atomic claim:
//       UPDATE slide_sets SET status='in_canva'
//        WHERE id=$1 AND status='ready_for_canva' RETURNING id
//     If RETURNING returns nothing, somebody else already took it.
//   • Runner writes render_result + status='visuals_ready' when done.
//
// We do NOT compute a placeholder Canva URL anymore — that was the
// pre-contract stub. render_result is the runner's column, owned by
// the runner, never written from this side.
export async function POST(
  req: Request,
  { params }: { params: { slideSetId: string } }
) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }

  const supabase = createServerClient()

  // Sanity-load so we can return a meaningful 404 / 409 before mutating.
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

  // Idempotent move to ready_for_canva. If a previous press already
  // queued us and the runner hasn't picked it up yet, this is a
  // no-op — the update lands the same value and the ping renotifies.
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

  // Fire-and-forget: Telegram ping to wake up the runner. Failures
  // here don't block the response — the DB row is the contract.
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
    slide_set_id: params.slideSetId,
    status: 'ready_for_canva',
  })
}
