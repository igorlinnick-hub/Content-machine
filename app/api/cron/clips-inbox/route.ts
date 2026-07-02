import { NextResponse } from 'next/server'
import { listInboxClips, type InboxClip } from '@/lib/clips/drive'
import { processClip } from '@/lib/clips/pipeline'
import { getClipStatusByInboxFile } from '@/lib/clips/store'
import {
  listClinicsWithDriveInbox,
  type ClinicDriveFolders,
} from '@/lib/google/clinicFolders'
import { disabledHttpResponse } from '@/lib/agents/disabled'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Same budget as /api/clips/process — the pipeline runs inside this
// function. An average 5-min clip takes 2-4 minutes.
export const maxDuration = 300

// Cron poll for clips Inboxes (closes §20 "Что НЕ сделано" item):
// doctor uploads to Drive get picked up automatically instead of
// waiting for a manual Telegram trigger.
//
// Two sources, walked in one pass:
// 1. Every clinic with a provisioned Drive workspace (migration 037,
//    lib/google/clinicFolders.ts) — its own Inbox/.
// 2. The legacy global Inbox (env GOOGLE_DRIVE_CLIPS_INBOX_ID),
//    attributed to CLIPS_DEFAULT_CLINIC_ID — HWC until provisioned.
//
// Manual triggers still work; the poller skips files that are already
// processing (race with a manual run) and files marked failed —
// failed clips stay in Inbox for MANUAL retry only, so a broken file
// doesn't re-bill Whisper every tick.
//
// Vercel cron schedule: `*/30 * * * *` — see vercel.json.

const MAX_CLIPS_PER_RUN = 3
// Stop picking up NEW clips once this much wall-clock is spent, so
// the clip we do start has budget to finish before the 300s ceiling.
const PICKUP_DEADLINE_MS = 180_000

interface InboxTarget {
  clinicId: string
  folders: ClinicDriveFolders | null
  clip: InboxClip
}

function checkAuth(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization') ?? ''
    if (auth === `Bearer ${cronSecret}`) return true
  }
  const internal = process.env.CONTENT_MACHINE_SECRET
  if (internal && req.headers.get('x-internal-dispatch-secret') === internal) {
    return true
  }
  return false
}

export async function GET(req: Request) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Whisper + Sonnet are pay-per-use — same kill switch as the manual
  // processing route.
  const off = await disabledHttpResponse()
  if (off) return off

  const startedAt = Date.now()
  try {
    const targets: InboxTarget[] = []

    // 1. Per-clinic inboxes.
    const clinics = await listClinicsWithDriveInbox()
    for (const c of clinics) {
      const clips = await listInboxClips(c.folders.inboxId)
      for (const clip of clips) {
        targets.push({ clinicId: c.clinicId, folders: c.folders, clip })
      }
    }

    // 2. Legacy global inbox (env), attributed to the default clinic.
    const legacyClinicId = process.env.CLIPS_DEFAULT_CLINIC_ID
    const legacyConfigured = Boolean(process.env.GOOGLE_DRIVE_CLIPS_INBOX_ID)
    if (legacyClinicId && legacyConfigured) {
      const clips = await listInboxClips()
      for (const clip of clips) {
        targets.push({ clinicId: legacyClinicId, folders: null, clip })
      }
    }

    if (targets.length === 0) {
      const hint =
        clinics.length === 0 && !legacyClinicId
          ? 'no provisioned clinics and CLIPS_DEFAULT_CLINIC_ID not set — poller is a no-op'
          : undefined
      return NextResponse.json({ ok: true, processed: 0, results: [], ...(hint ? { hint } : {}) })
    }

    const results: Array<Record<string, unknown>> = []
    let processedCount = 0

    for (const t of targets) {
      if (processedCount >= MAX_CLIPS_PER_RUN) {
        results.push({ ok: false, name: t.clip.name, skipped: 'run cap reached — next tick picks it up' })
        continue
      }
      if (Date.now() - startedAt > PICKUP_DEADLINE_MS) {
        results.push({ ok: false, name: t.clip.name, skipped: 'time budget spent — next tick picks it up' })
        continue
      }

      const status = await getClipStatusByInboxFile(t.clinicId, t.clip.id)
      if (status === 'processing' || status === 'failed' || status === 'cleaned') {
        results.push({ ok: false, name: t.clip.name, skipped: `status=${status}` })
        continue
      }

      try {
        const r = await processClip({
          clinicId: t.clinicId,
          inboxClip: t.clip,
          triggeredChatId: null,
          folders: t.folders,
        })
        processedCount += 1
        results.push({ ok: true, name: t.clip.name, ...r })
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown'
        results.push({ ok: false, name: t.clip.name, error: msg })
      }
    }

    return NextResponse.json({ ok: true, processed: processedCount, results })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
