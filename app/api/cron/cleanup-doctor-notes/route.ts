import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Daily cleanup of doctor_notes older than 3 days. The doctor's
// quiz answers feed the analyst, which lifts the durable signal
// into insights / few_shot_library / diff_rules. After 3 days the
// raw note no longer adds value — the analyst-derived insights
// remain. Hard-deleting raw rows reduces dup risk in future
// generations and keeps the doctor's free-form text from sitting
// around indefinitely.
//
// Vercel cron schedule: `0 3 * * *` (daily 03:00 UTC) — see
// vercel.json.
//
// Auth: Vercel attaches `Authorization: Bearer ${CRON_SECRET}` to
// scheduled cron requests when CRON_SECRET is set in env. We
// accept that OR our own internal-dispatch header for manual
// triggers.

const TTL_DAYS = 3

function checkAuth(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization') ?? ''
    if (auth === `Bearer ${cronSecret}`) return true
  }
  const internal = process.env.TELEGRAM_WEBHOOK_SECRET
  if (internal && req.headers.get('x-internal-dispatch-secret') === internal) {
    return true
  }
  // No secrets configured at all — allow (so local dev runs). In
  // prod CRON_SECRET should always be set.
  return !cronSecret && !internal
}

export async function GET(req: Request) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(
    Date.now() - TTL_DAYS * 24 * 60 * 60 * 1000
  ).toISOString()

  try {
    const supabase = createServerClient()
    const { data, error, count } = await supabase
      .from('doctor_notes')
      .delete({ count: 'exact' })
      .lt('created_at', cutoff)
      .select('id')
    if (error) throw error
    return NextResponse.json({
      ok: true,
      deleted: count ?? data?.length ?? 0,
      cutoff,
      ttl_days: TTL_DAYS,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
