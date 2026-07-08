import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { resolveAccess } from '@/lib/auth/session'
import { copyFileToInbox, readClipsEnv } from '@/lib/clips/drive'
import { processClip } from '@/lib/clips/pipeline'
import { notifyClipCleaned } from '@/lib/clips/notify'
import { getClinicDriveFolders } from '@/lib/google/clinicFolders'
import { disabledHttpResponse } from '@/lib/agents/disabled'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Same budget as /api/clips/process — Whisper + 2 ffmpeg passes on a
// teleprompter take (≤3 min) lands well inside it.
export const maxDuration = 300

// Teleprompter "Auto-edit" (HANDOFF §22.2 п.11): copy a saved
// recording from Recordings/ into the clinic's clips Inbox and run
// the cleanup pipeline on it synchronously. Self-healing: once the
// copy is in the Inbox, a dropped connection just means the cron
// sweeps it up within 30 min instead.

export async function POST(req: Request) {
  const access = await resolveAccess()
  if (!access) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  // Whisper is pay-per-use — same kill switch as the process route.
  const off = await disabledHttpResponse()
  if (off) return off

  let body: { recordingId?: string }
  try {
    body = (await req.json()) as { recordingId?: string }
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  if (!body.recordingId) {
    return NextResponse.json({ error: 'recordingId required' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data: recording } = await supabase
    .from('clinic_recordings')
    .select('id, clinic_id, drive_file_id, title')
    .eq('id', body.recordingId)
    .maybeSingle()

  if (!recording) {
    return NextResponse.json({ error: 'recording not found' }, { status: 404 })
  }
  if (access.role !== 'admin' && recording.clinic_id !== access.clinicId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const clinicId = recording.clinic_id as string

  // Per-clinic Inbox when provisioned, legacy global env Inbox
  // otherwise (HWC today). Neither configured → clips are off for
  // this deployment.
  const folders = await getClinicDriveFolders(clinicId)
  let inboxId: string
  try {
    inboxId = folders?.inboxId ?? readClipsEnv().inboxId
  } catch {
    return NextResponse.json(
      { error: 'clips pipeline is not configured for this clinic' },
      { status: 400 }
    )
  }

  try {
    const inboxClip = await copyFileToInbox(
      recording.drive_file_id as string,
      inboxId
    )
    const result = await processClip({ clinicId, inboxClip, folders })
    // Web-push ping too — the doctor may have left the page while
    // the pipeline ran. Best-effort.
    await notifyClipCleaned({
      clinicId,
      clipName: inboxClip.name,
      result,
    })
    return NextResponse.json({ ok: true, clip: result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'processing failed'
    // The copy may already sit in the Inbox — the clip shows up as
    // failed in /clips; retry is manual from there.
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
