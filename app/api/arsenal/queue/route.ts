import { NextResponse } from 'next/server'
import {
  loadPendingIngests,
  markIngestProcessing,
  markIngestFailed,
} from '@/lib/arsenal/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Endpoint surface for the local Claude Code skill
// `script-arsenal-ingest`. The skill polls this route, claims a row by
// marking it processing, then later POSTs the extraction to
// /api/arsenal/draft. If extraction fails it POSTs here with
// { action: 'fail', queue_id, error } so the queue row reflects it.
//
// Auth: same shared secret as webhook→dispatch, so a single env var
// (CONTENT_MACHINE_SECRET) authenticates Igor's machine into the API.

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
    const rows = await loadPendingIngests(limit)
    return NextResponse.json({ ok: true, count: rows.length, rows })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

interface PostBody {
  action: 'claim' | 'fail'
  queue_id: string
  error?: string
}

export async function POST(req: Request) {
  if (!checkSecret(req)) {
    return NextResponse.json({ error: 'invalid secret' }, { status: 401 })
  }
  let body: PostBody
  try {
    body = (await req.json()) as PostBody
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  if (!body.queue_id) {
    return NextResponse.json({ error: 'queue_id required' }, { status: 400 })
  }
  try {
    if (body.action === 'claim') {
      await markIngestProcessing(body.queue_id)
      return NextResponse.json({ ok: true })
    }
    if (body.action === 'fail') {
      await markIngestFailed(body.queue_id, body.error ?? 'unknown')
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'invalid action' }, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
