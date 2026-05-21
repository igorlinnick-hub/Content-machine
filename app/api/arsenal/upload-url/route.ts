import { NextResponse } from 'next/server'
import { createUploadTargets } from '@/lib/arsenal/storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Skill GETs this to obtain Supabase signed-upload URLs for the mp4 +
// thumbnail. It PUTs both blobs directly to Storage (so Vercel never
// sees the video bytes — keeps the function payload + Vercel cold-
// start time tractable) and then references the paths when POSTing
// /api/arsenal/draft.
//
// We need an arsenal_id to namespace the path; for the first ingest
// (where no arsenal row exists yet) the skill passes a queue_id
// instead — we use it as the path hint and the actual arsenal row
// inherits the same path when /api/arsenal/draft is called.

function checkSecret(req: Request): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!expected) return true
  return req.headers.get('x-internal-dispatch-secret') === expected
}

export async function GET(req: Request) {
  if (!checkSecret(req)) {
    return NextResponse.json({ error: 'invalid secret' }, { status: 401 })
  }
  const url = new URL(req.url)
  const clinicId = url.searchParams.get('clinic_id')
  const idHint =
    url.searchParams.get('arsenal_id') ?? url.searchParams.get('queue_id')
  if (!clinicId || !idHint) {
    return NextResponse.json(
      { error: 'clinic_id and arsenal_id or queue_id required' },
      { status: 400 }
    )
  }
  try {
    const targets = await createUploadTargets(clinicId, idHint)
    return NextResponse.json({ ok: true, ...targets })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
