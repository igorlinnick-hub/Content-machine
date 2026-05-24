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
  // Free-form question/brief — same role as the TG link+question
  // path. When present (≥8 chars), the queue row is tagged
  // intent='template_for_clinic' and the skill additionally writes
  // a clinic-tailored template proposal.
  userContext?: string
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
  const userContext = body.userContext?.trim()
  const wantsTemplate = !!userContext && userContext.length >= 8
  try {
    const { row, reused, upgraded } = await enqueueIngest({
      clinicId,
      sourceUrl: detected.url,
      platform: detected.platform,
      requestedByChatId: null,
      requestedByName: 'admin:web',
      intent: wantsTemplate ? 'template_for_clinic' : 'ingest_only',
      userContext: wantsTemplate ? userContext : null,
    })
    return NextResponse.json({ ok: true, queue: row, reused, upgraded })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
