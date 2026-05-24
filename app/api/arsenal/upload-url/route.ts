import { NextResponse } from 'next/server'
import { createUploadTargets } from '@/lib/arsenal/storage'
import { resolveAccess } from '@/lib/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Issues short-lived signed-upload URLs against the arsenal-videos
// bucket so the caller can PUT the mp4 + thumbnail directly to
// Storage (avoids passing huge bytes through this Vercel function).
//
// Two auth paths:
//   1. Local Claude Code skill — uses x-internal-dispatch-secret
//      header (same shared secret as the TG webhook).
//   2. Admin browser — uses the Supabase session cookie. Lets the
//      /arsenal admin UI offer drag-and-drop video upload without
//      knowing the secret.
//
// We need an arsenal_id to namespace the path. The skill knows it
// after /api/arsenal/draft creates the row. The browser path
// doesn't have an arsenal_id yet so we accept a queue_id (or a
// freshly-minted 'upload_<rand>' hint) instead — the same path is
// later persisted onto the script_arsenal row when /api/arsenal/draft
// is called by the skill.

function checkSecret(req: Request): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!expected) return true
  return req.headers.get('x-internal-dispatch-secret') === expected
}

async function authorize(req: Request): Promise<boolean> {
  if (checkSecret(req)) return true
  const access = await resolveAccess()
  return Boolean(access && access.role === 'admin')
}

export async function GET(req: Request) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
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
