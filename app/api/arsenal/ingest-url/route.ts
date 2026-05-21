import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { detectIngestUrl, enqueueIngest } from '@/lib/arsenal/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Admin-only counterpart to the Telegram URL-paste path. Igor's
// team uses this when they want to ingest a reference video without
// switching to TG. Lands in the same queue, picked up by the same
// local skill — only the trigger surface differs.

interface Body {
  clinicId?: string
  url?: string
}

export async function POST(req: Request) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  const clinicId = body.clinicId?.trim()
  const rawUrl = body.url?.trim()
  if (!clinicId || !rawUrl) {
    return NextResponse.json(
      { error: 'clinicId and url required' },
      { status: 400 }
    )
  }
  const detected = detectIngestUrl(rawUrl)
  if (!detected) {
    return NextResponse.json(
      {
        error:
          'no supported video URL found — paste an Instagram / YouTube / TikTok link',
      },
      { status: 400 }
    )
  }
  try {
    const { row, reused } = await enqueueIngest({
      clinicId,
      sourceUrl: detected.url,
      platform: detected.platform,
      requestedByChatId: null,
      requestedByName: 'admin:web',
    })
    return NextResponse.json({ ok: true, queue: row, reused })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
