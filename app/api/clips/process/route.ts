import { NextResponse } from 'next/server'
import { listInboxClips } from '@/lib/clips/drive'
import { processClip } from '@/lib/clips/pipeline'
import { getClinicDriveFolders } from '@/lib/google/clinicFolders'
import { disabledHttpResponse } from '@/lib/agents/disabled'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Hobby plan hard ceiling: 300s is both the default AND the maximum
// (Pro gets 800s / 2 vCPU). Setting 800 does not slow the render down —
// it makes the whole deployment fail to build, so nothing ships at all.
// The §22.2b two-pass 1080x1920 encode runs ~4x realtime on Hobby's
// single vCPU, i.e. only ~70s of footage fits here. Longer takes must
// move off the lambda (local/dedicated runner) — see HANDOFF clips.
export const maxDuration = 300

interface Body {
  clinicId: string
  // When provided, only this Inbox file is processed. Otherwise we
  // walk the whole Inbox in createdTime order.
  inboxFileId?: string
}

function checkSecret(req: Request): boolean {
  const expected = process.env.CONTENT_MACHINE_SECRET
  if (!expected) return false
  return req.headers.get('x-internal-dispatch-secret') === expected
}

export async function POST(req: Request) {
  if (!checkSecret(req)) {
    return NextResponse.json({ error: 'invalid secret' }, { status: 401 })
  }

  // OpenAI Whisper is pay-per-use; same flag as Anthropic so the
  // subscription-only mode is total.
  const off = await disabledHttpResponse()
  if (off) return off

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  if (!body.clinicId) {
    return NextResponse.json({ error: 'clinicId required' }, { status: 400 })
  }

  try {
    // Clinic with provisioned Drive folders → its own Inbox; otherwise
    // the legacy global Inbox from env.
    const folders = await getClinicDriveFolders(body.clinicId)
    const inbox = await listInboxClips(folders?.inboxId)
    const targets = body.inboxFileId
      ? inbox.filter((c) => c.id === body.inboxFileId)
      : inbox
    if (targets.length === 0) {
      return NextResponse.json({ ok: true, processed: 0, results: [] })
    }
    const results = []
    for (const clip of targets) {
      try {
        const r = await processClip({
          clinicId: body.clinicId,
          inboxClip: clip,
          folders,
        })
        results.push({ ok: true as const, name: clip.name, ...r })
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown'
        results.push({ ok: false as const, name: clip.name, error: msg })
      }
    }
    return NextResponse.json({ ok: true, processed: results.length, results })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
