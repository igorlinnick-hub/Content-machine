import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import { getServiceAccountToken, getUserAccessToken } from '@/lib/google/drive'

export const runtime = 'nodejs'
// Long takes stream for minutes; the function only pipes bytes, it holds no CPU.
export const maxDuration = 300

// Play a Drive-hosted take from OUR origin instead of Drive's /preview iframe.
//
// Why this exists (2026-09-17): Drive's embedded player refuses to play a file
// until Drive has transcoded its own rendition — for a take that finished
// uploading a minute ago the iframe shows "This video file is still being
// processed for playback", which is the first thing a doctor sees after
// recording. But the file itself is already playable: the teleprompter records
// H.264 in mp4 (see TeleprompterView mimeType list), i.e. exactly what the
// phone can decode. So we hand the browser the original bytes and skip Drive's
// processing queue entirely.
//
// Watch-only still holds: the URL is behind the session cookie and scoped to
// the caller's own clinic, and we send it inline with no filename. It is not
// the download door the Drive folder chips are — those stay admin-only.

// A fileId is playable only if it is one of this clinic's own takes or one of
// its finished edits. Never trust the id in the URL on its own.
async function canPlay(fileId: string, clinicId: string | null): Promise<boolean> {
  const supabase = createServerClient()

  const { data: rec } = await supabase
    .from('clinic_recordings')
    .select('clinic_id')
    .eq('drive_file_id', fileId)
    .eq('status', 'final')
    .maybeSingle()
  if (rec) return clinicId === null || rec.clinic_id === clinicId

  const { data: clip } = await supabase
    .from('clips')
    .select('clinic_id')
    .eq('cleaned_file_id', fileId)
    .maybeSingle()
  if (clip) return clinicId === null || clip.clinic_id === clinicId

  return false
}

async function driveToken(): Promise<string> {
  const user = await getUserAccessToken().catch(() => null)
  if (user) return user
  return getServiceAccountToken()
}

export async function GET(req: Request, { params }: { params: { fileId: string } }) {
  const access = await resolveAccess()
  if (!access) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const clinicId = access.role === 'admin' ? null : access.clinicId
  if (!(await canPlay(params.fileId, clinicId))) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  // Range passes straight through: Safari opens every video with a probe range
  // and then seeks by range, so a 200-only proxy would break the scrubber.
  const range = req.headers.get('range')
  const token = await driveToken()
  const upstream = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(params.fileId)}?alt=media&supportsAllDrives=true`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(range ? { Range: range } : {}),
      },
      cache: 'no-store',
    }
  )

  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json(
      { error: `drive returned ${upstream.status}` },
      { status: upstream.status === 404 ? 404 : 502 }
    )
  }

  const headers = new Headers()
  headers.set('Content-Type', upstream.headers.get('content-type') ?? 'video/mp4')
  headers.set('Accept-Ranges', 'bytes')
  headers.set('Content-Disposition', 'inline')
  headers.set('Cache-Control', 'private, max-age=0, no-store')
  const len = upstream.headers.get('content-length')
  if (len) headers.set('Content-Length', len)
  const contentRange = upstream.headers.get('content-range')
  if (contentRange) headers.set('Content-Range', contentRange)

  return new NextResponse(upstream.body, { status: upstream.status, headers })
}
