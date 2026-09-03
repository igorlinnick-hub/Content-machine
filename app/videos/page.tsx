import { redirect } from 'next/navigation'
import { resolveAccess } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import { loadRecentClips } from '@/lib/clips/store'
import { getClinicRecordingsFolderId } from '@/lib/google/recordings'
import { getFloorFolderId, loadFloorMedia } from '@/lib/floor/store'
import { PageHeader } from '@/app/components/PageHeader'
import PushToggle from '@/app/components/PushToggle'
import VideoLibrary, { type FolderLink, type LibraryItem } from './VideoLibrary'
import type { FloorItem } from './FloorPanel'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'My videos — Content Machine' }

// Doctor-facing video library (added 2026-08-19). Pure viewing: every take
// the doctor recorded in the teleprompter, plus the edited versions once the
// team has run Auto-edit on them — all playable in-app via the Drive embed
// (files are made link-viewable on upload, see allowLinkView). No editing,
// no deleting here: the editor's tools live in admin-only /clips.
//
// Second tab (added 2026-08-31): "From the floor" — the photos and clips the
// medical assistants upload through the clinic's Google Form, mirrored from
// its Drive folder (lib/floor/*). Its own tab on purpose: MA b-roll is not
// the doctor's takes, and it earns no extra dashboard card. ADMIN ONLY —
// the doctor's view of this page is unchanged from before it existed.

interface PageProps {
  searchParams: { clinicId?: string; tab?: string }
}

export default async function VideosPage({ searchParams }: PageProps) {
  const access = await resolveAccess()
  if (!access) redirect('/')

  const clinicId =
    access.role === 'admin' ? searchParams.clinicId ?? '' : access.clinicId
  if (!clinicId) redirect('/dashboard')

  const supabase = createServerClient()
  const [{ data: clinic }, { data: recordingRows }, clips, floorRows, floorFolderId] =
    await Promise.all([
    supabase
      .from('clinics')
      .select(
        'name, full_name, drive_root_folder_id, drive_inbox_folder_id, drive_finals_folder_id, photo_library_folder_id, drive_floor_folder_id'
      )
      .eq('id', clinicId)
      .single(),
    supabase
      .from('clinic_recordings')
      .select('id, title, drive_file_id, drive_url, duration_sec, size_bytes, created_at')
      .eq('clinic_id', clinicId)
      .eq('status', 'final')
      .order('created_at', { ascending: false })
      .limit(100),
    loadRecentClips(clinicId, 100).catch(() => []),
    // Admin-only feed, so a doctor's page load doesn't even query it.
    // Fail-soft on both: migration 052 not applied yet must not take the
    // doctor's own library down with it.
    access.role === 'admin'
      ? loadFloorMedia(clinicId, 300).catch(() => [])
      : Promise.resolve([]),
    access.role === 'admin'
      ? getFloorFolderId(clinicId).catch(() => null)
      : Promise.resolve(null),
  ])
  if (!clinic) redirect('/dashboard')

  // "Their materials stay theirs" (Access & Terms) made concrete: direct
  // links to the clinic's own Drive folders — teleprompter takes, finished
  // edits, raw uploads, photos. The folders carry anyone-with-link reader
  // (see allowLinkView call sites), so a doctor signed into no Google
  // account still gets in. Absent id = absent chip, never an error.
  const recordingsFolderId = await getClinicRecordingsFolderId(clinic.name).catch(
    () => null
  )
  const folderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`
  const folders: FolderLink[] = []
  if (recordingsFolderId)
    folders.push({ key: 'recordings', label: 'Recordings', url: folderUrl(recordingsFolderId) })
  if (clinic.drive_finals_folder_id)
    folders.push({
      key: 'finals',
      label: 'Finished videos',
      url: folderUrl(clinic.drive_finals_folder_id),
    })
  // The Inbox is the team's internal door into auto-edit — the doctor's
  // channels are the teleprompter and the MA form (Igor 2026-09-03).
  if (clinic.drive_inbox_folder_id && access.role === 'admin')
    folders.push({
      key: 'inbox',
      label: 'Uploads inbox',
      url: folderUrl(clinic.drive_inbox_folder_id),
    })
  // Admin-only, like the inbox: the photo library feeds the Posts
  // workspace, which doctors don't have.
  if (clinic.photo_library_folder_id && access.role === 'admin')
    folders.push({
      key: 'photos',
      label: 'Photo library',
      url: folderUrl(clinic.photo_library_folder_id),
    })
  if (clinic.drive_floor_folder_id)
    folders.push({
      key: 'floor',
      label: 'Clinic photos & clips',
      url: folderUrl(clinic.drive_floor_folder_id),
    })

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

  const floorItems: FloorItem[] = floorRows.map((m) => ({
    id: m.id,
    kind: m.kind,
    fileName: m.file_name,
    driveUrl: m.drive_url,
    thumbnailUrl: m.thumbnail_url,
    fileId: m.drive_file_id,
    uploader: m.uploader,
    folderName: m.drive_folder_name,
    durationSec: m.duration_sec,
    sizeBytes: m.size_bytes,
    uploadedAt: m.uploaded_at,
  }))

  const back = access.role === 'admin' ? `/dashboard?clinicId=${clinicId}` : '/dashboard'

  return (
    <main className="min-h-screen cm-page-bg">
      <div className="mx-auto flex max-w-6xl flex-col gap-7 px-4 py-6 sm:px-6 sm:py-8">
        <PageHeader
          eyebrow={clinic.full_name ?? clinic.name}
          eyebrowColor="text-violet-500"
          title="My videos"
          subtitle="Your teleprompter takes, and what the team shot on the floor."
          back={back}
        />
        <div className="-mt-2 flex justify-end">
          {/* The only place a device can subscribe — without it the
              "new recording" / "new from the floor" pings go nowhere. */}
          <PushToggle clinicId={clinicId} compact />
        </div>
        <VideoLibrary
          recordings={recordings}
          edited={edited}
          folders={folders}
          teleprompterHref={access.role === 'admin' ? `/teleprompter?clinicId=${clinicId}` : '/teleprompter'}
          clinicId={clinicId}
          isAdmin={access.role === 'admin'}
          floorItems={floorItems}
          floorConnected={Boolean(floorFolderId)}
          initialTab={searchParams.tab === 'floor' ? 'floor' : 'mine'}
        />
      </div>
    </main>
  )
}
