import { redirect } from 'next/navigation'
import { resolveAccess } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import { loadRecentClips } from '@/lib/clips/store'
import { PageHeader } from '@/app/components/PageHeader'
import VideoLibrary, { type LibraryItem } from './VideoLibrary'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'My videos — Content Machine' }

// Doctor-facing video library (added 2026-08-19). Pure viewing: every take
// the doctor recorded in the teleprompter, plus the edited versions once the
// team has run Auto-edit on them — all playable in-app via the Drive embed
// (files are made link-viewable on upload, see allowLinkView). No editing,
// no deleting here: the editor's tools live in admin-only /clips.

interface PageProps {
  searchParams: { clinicId?: string }
}

export default async function VideosPage({ searchParams }: PageProps) {
  const access = await resolveAccess()
  if (!access) redirect('/')

  const clinicId =
    access.role === 'admin' ? searchParams.clinicId ?? '' : access.clinicId
  if (!clinicId) redirect('/dashboard')

  const supabase = createServerClient()
  const [{ data: clinic }, { data: recordingRows }, clips] = await Promise.all([
    supabase.from('clinics').select('name, full_name').eq('id', clinicId).single(),
    supabase
      .from('clinic_recordings')
      .select('id, title, drive_file_id, drive_url, duration_sec, size_bytes, created_at')
      .eq('clinic_id', clinicId)
      .eq('status', 'final')
      .order('created_at', { ascending: false })
      .limit(100),
    loadRecentClips(clinicId, 100).catch(() => []),
  ])
  if (!clinic) redirect('/dashboard')

  const recordings: LibraryItem[] = (recordingRows ?? []).map((r) => ({
    id: r.id,
    kind: 'recording',
    title: r.title || 'Untitled',
    fileId: r.drive_file_id,
    driveUrl: r.drive_url ?? `https://drive.google.com/file/d/${r.drive_file_id}/view`,
    durationSec: r.duration_sec ?? null,
    sizeBytes: r.size_bytes ?? null,
    createdAt: r.created_at,
  }))

  // Only finished edits are shown to the doctor — processing/failed rows are
  // the editor's business, not something to explain on this screen.
  const edited: LibraryItem[] = clips
    .filter((c) => c.status === 'cleaned' && c.cleaned_file_id)
    .map((c) => ({
      id: c.id,
      kind: 'edited',
      title: c.drive_inbox_file_name
        .replace(/\.(mp4|webm|mov)$/i, '')
        .replace(/^\d{4}-\d{2}-\d{2}_/, '')
        .replace(/_/g, ' ') || 'Edited video',
      fileId: c.cleaned_file_id as string,
      driveUrl: `https://drive.google.com/file/d/${c.cleaned_file_id}/view`,
      durationSec: c.duration_out_sec ?? null,
      sizeBytes: null,
      createdAt: c.completed_at ?? c.created_at,
    }))

  const back = access.role === 'admin' ? `/dashboard?clinicId=${clinicId}` : '/dashboard'

  return (
    <main className="min-h-screen cm-page-bg">
      <div className="mx-auto flex max-w-6xl flex-col gap-7 px-4 py-6 sm:px-6 sm:py-8">
        <PageHeader
          eyebrow={clinic.full_name ?? clinic.name}
          eyebrowColor="text-violet-500"
          title="My videos"
          subtitle="Everything you recorded in the teleprompter, plus the edited versions when they're ready."
          back={back}
        />
        <VideoLibrary
          recordings={recordings}
          edited={edited}
          teleprompterHref={access.role === 'admin' ? `/teleprompter?clinicId=${clinicId}` : '/teleprompter'}
        />
      </div>
    </main>
  )
}
