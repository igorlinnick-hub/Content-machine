import { NextResponse } from 'next/server'
import { loadRefineQueue } from '@/lib/arsenal/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Polled by the local Claude Code skill. Returns arsenal rows that
// have a non-null pending_refine_note. Skill picks them up, applies
// the operator's note (re-extraction using cached or re-pulled
// transcript + keyframes), POSTs the refreshed fields back to
// /api/arsenal/[id]/apply-refinement.
//
// Secret-gated to match the existing /api/arsenal/queue pattern so a
// single env var (CONTENT_MACHINE_SECRET) authenticates Igor's
// machine into all arsenal-skill endpoints.

function checkSecret(req: Request): boolean {
  const expected = process.env.CONTENT_MACHINE_SECRET
  if (!expected) return false
  return req.headers.get('x-internal-dispatch-secret') === expected
}

export async function GET(req: Request) {
  if (!checkSecret(req)) {
    return NextResponse.json({ error: 'invalid secret' }, { status: 401 })
  }
  const url = new URL(req.url)
  const limit = Math.min(
    parseInt(url.searchParams.get('limit') ?? '10', 10) || 10,
    50
  )
  try {
    const rows = await loadRefineQueue(limit)
    return NextResponse.json({ ok: true, count: rows.length, rows })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
