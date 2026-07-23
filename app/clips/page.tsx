import { redirect } from 'next/navigation'
import Link from 'next/link'
import { resolveAccess } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import { getClinicCaptionStyle, loadRecentClips } from '@/lib/clips/store'
import { DEFAULT_CAPTION_STYLE_KEY } from '@/lib/clips/captionStyles'
import CaptionStylePicker from './CaptionStylePicker'
import MarkClipsSeen from './MarkClipsSeen'
import RecordingsPanel, { type RecordingRow } from './RecordingsPanel'
import ReadyVideosPanel from './ReadyVideosPanel'

export const dynamic = 'force-dynamic'

// The video editor tab — ADMIN ONLY (HANDOFF §22.2 пп.7+9-11).
// Top to bottom: the editing team's work queue (doctor recordings
// with in-app preview + Auto-edit + delete), the caption template
// picker, and Ready videos — processed clips watchable in-app.
// Doctors never see this page — their surface ends at the
// teleprompter upload.

export default async function ClipsPage({
  searchParams,
}: {
  searchParams: { clinicId?: string }
}) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') redirect('/')

  const clinicId = searchParams.clinicId ?? ''

  const clips = clinicId ? await loadRecentClips(clinicId, 50) : []
  const captionStyle = clinicId
    ? (await getClinicCaptionStyle(clinicId)) ?? DEFAULT_CAPTION_STYLE_KEY
    : DEFAULT_CAPTION_STYLE_KEY

  let recordings: RecordingRow[] = []
  if (clinicId) {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('clinic_recordings')
      .select('id, title, drive_file_id, duration_sec, size_bytes, created_at')
      .eq('clinic_id', clinicId)
      .eq('status', 'final')
      .order('created_at', { ascending: false })
      .limit(50)
    recordings = (data ?? []) as unknown as RecordingRow[]
  }

  return (
    <main className="min-h-screen cm-page-bg">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <header>
          <Link
            href={clinicId ? `/dashboard?clinicId=${clinicId}` : '/dashboard'}
            className="text-sm text-neutral-400 hover:text-neutral-600"
          >
            ‹ Dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Video editor</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Doctor recordings in, ready videos out. Files also live in the
            clinic&apos;s Drive folder.
          </p>
        </header>

        {!clinicId ? (
          <p className="text-sm text-neutral-500">
            Add <code>?clinicId=…</code> to open a clinic&apos;s video editor.
          </p>
        ) : (
          <>
            <MarkClipsSeen clinicId={clinicId} />
            <RecordingsPanel clinicId={clinicId} recordings={recordings} />
            <CaptionStylePicker clinicId={clinicId} initial={captionStyle} />
            <ReadyVideosPanel clips={clips} />
          </>
        )}
      </div>
    </main>
  )
}
