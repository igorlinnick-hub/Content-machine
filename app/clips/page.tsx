import { redirect } from 'next/navigation'
import { resolveAccess } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import {
  getClinicCaptionStyle,
  loadRecentClips,
  type ClipRow,
} from '@/lib/clips/store'
import { clipFolderUrl } from '@/lib/clips/drive'
import { DEFAULT_CAPTION_STYLE_KEY } from '@/lib/clips/captionStyles'
import CaptionStylePicker from './CaptionStylePicker'
import MarkClipsSeen from './MarkClipsSeen'
import PushToggle from '@/app/components/PushToggle'
import RecordingsPanel, { type RecordingRow } from './RecordingsPanel'

export const dynamic = 'force-dynamic'

// The video editor tab — ADMIN ONLY (HANDOFF §22.2 пп.7+9-11).
// The editing team's work queue: doctor recordings with in-app
// preview + Auto-edit + delete, the caption template picker, and
// the processed-clips table. Doctors never see this page — their
// surface ends at the teleprompter upload.

function driveFileUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`
}

function fmtDuration(sec: number | null): string {
  if (sec == null) return '—'
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

const STATUS_STYLES: Record<ClipRow['status'], string> = {
  cleaned: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  processing: 'bg-sky-50 text-sky-700 border-sky-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  failed: 'bg-rose-50 text-rose-700 border-rose-200',
}

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
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Video editor</h1>
            <p className="mt-1 text-sm text-neutral-500">
              Doctor uploads processed by the cleanup pipeline. Originals and
              finals live in the clinic&apos;s Drive folder.
            </p>
          </div>
          {clinicId ? <PushToggle clinicId={clinicId} compact /> : null}
        </header>

        {clinicId ? (
          <>
            <MarkClipsSeen clinicId={clinicId} />
            <RecordingsPanel clinicId={clinicId} recordings={recordings} />
            <CaptionStylePicker clinicId={clinicId} initial={captionStyle} />
          </>
        ) : null}

        {!clinicId ? (
          <p className="text-sm text-neutral-500">
            Add <code>?clinicId=…</code> to view a clinic&apos;s clips.
          </p>
        ) : clips.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No clips yet. Drop a video into the clinic&apos;s Inbox folder on
            Drive — the pipeline picks it up automatically.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
                  <th className="px-4 py-3">File</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Cuts</th>
                  <th className="px-4 py-3">Links</th>
                </tr>
              </thead>
              <tbody>
                {clips.map((clip) => (
                  <tr key={clip.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-3">
                      <div className="max-w-[220px] truncate font-medium" title={clip.drive_inbox_file_name}>
                        {clip.drive_inbox_file_name}
                      </div>
                      <div className="text-xs text-neutral-400">
                        {new Date(clip.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[clip.status]}`}
                      >
                        {clip.status}
                      </span>
                      {clip.status === 'failed' && clip.error ? (
                        <div className="mt-1 max-w-[220px] truncate text-xs text-rose-500" title={clip.error}>
                          {clip.error}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {fmtDuration(clip.duration_in_sec)}
                      {clip.duration_out_sec != null ? ` → ${fmtDuration(clip.duration_out_sec)}` : ''}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-neutral-500">
                      {clip.cuts_filler_count != null || clip.cuts_silence_count != null
                        ? `${clip.cuts_filler_count ?? 0} filler · ${clip.cuts_silence_count ?? 0} silence`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs">
                      <div className="flex gap-3">
                        {clip.cleaned_file_id ? (
                          <a
                            className="font-medium text-sky-600 hover:underline"
                            href={driveFileUrl(clip.cleaned_file_id)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Final
                          </a>
                        ) : null}
                        <a
                          className="text-neutral-500 hover:underline"
                          href={driveFileUrl(clip.drive_inbox_file_id)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Original
                        </a>
                        {clip.drive_clip_folder_id ? (
                          <a
                            className="text-neutral-500 hover:underline"
                            href={clipFolderUrl(clip.drive_clip_folder_id)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Folder
                          </a>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
