import { allowLinkView } from '@/lib/google/drive'
import { sendPushToAdmins } from '@/lib/push/send'
import { describeFolder, FLOOR_FILE_CAP, listFloorFiles } from './drive'
import {
  backfillFloorMetadata,
  getFloorFolderId,
  insertNewFloorMedia,
  pruneMissingFloorMedia,
  type FloorMediaRow,
} from './store'

// One sync = "make the app agree with the clinic's Google-Form folder".
// Called three ways: the daily cron (with the push), the Sync now
// button, and a page load of the Floor tab (quietly, so the gallery is
// never staler than the moment it was opened).

export interface FloorSyncResult {
  configured: boolean
  folderId: string | null
  seen: number
  added: FloorMediaRow[]
  pruned: number
  // Drive answers an inaccessible folder with an EMPTY LIST, not an
  // error — so "nothing found" is ambiguous until we ask Drive whether
  // it can open the folder at all. Without this the screen says
  // "Nothing here yet" while the real problem is a missing share.
  access?: 'ok' | 'denied'
  error?: string
}

// Drive thumbnails and the preview iframe are fetched by the viewer's
// browser, which may hold a different Google account than the folder
// owner — without link-view the gallery renders grey tiles. Best-effort
// and capped: the files we just discovered, nothing older.
const LINK_VIEW_BATCH = 30

async function makeViewable(rows: FloorMediaRow[]): Promise<void> {
  for (const row of rows.slice(0, LINK_VIEW_BATCH)) {
    await allowLinkView(row.drive_file_id).catch(() => {})
  }
}

export async function syncFloorMedia(params: {
  clinicId: string
  notify?: boolean
  prune?: boolean
}): Promise<FloorSyncResult> {
  const folderId = await getFloorFolderId(params.clinicId)
  if (!folderId) {
    return { configured: false, folderId: null, seen: 0, added: [], pruned: 0 }
  }

  const files = await listFloorFiles(folderId)
  if (files.length === 0) {
    const folder = await describeFolder(folderId)
    if (!folder) {
      return {
        configured: true,
        folderId,
        seen: 0,
        added: [],
        pruned: 0,
        access: 'denied',
      }
    }
  }
  const added = await insertNewFloorMedia(params.clinicId, files)
  await makeViewable(added)
  // Rows stored before Drive finished processing get their duration and
  // dimensions on a later pass.
  await backfillFloorMetadata(params.clinicId, files).catch(() => 0)

  // Only the cron prunes, and only on a complete listing: an on-view
  // sync that hit a transient Drive error must never mistake "listed
  // nothing" for "the MA deleted it", and a folder that hit the walk
  // cap is by definition a partial view — pruning against it would
  // delete the tail of the archive.
  let pruned = 0
  if (params.prune && files.length > 0 && files.length < FLOOR_FILE_CAP) {
    pruned = await pruneMissingFloorMedia(
      params.clinicId,
      files.map((f) => f.id)
    )
  }

  if (params.notify && added.length > 0) {
    await notifyFloorUploads(params.clinicId, added)
  }

  return { configured: true, folderId, seen: files.length, added, pruned, access: 'ok' }
}

// "The MAs uploaded" ping — same channel as the clips pings (web push
// + in-app badge, HANDOFF §22.2 п.9). ADMIN DEVICES ONLY: the feed is
// an admin screen, so pinging the doctor would point them at a tab
// they cannot open. Aggregated: one notification per sync, never one
// per file, or a shift's worth of uploads would be a dozen buzzes.
// Never throws.
export async function notifyFloorUploads(
  clinicId: string,
  added: FloorMediaRow[]
): Promise<void> {
  try {
    const videos = added.filter((a) => a.kind === 'video').length
    const photos = added.length - videos
    const parts = [
      ...(videos > 0 ? [`${videos} ${videos === 1 ? 'clip' : 'clips'}`] : []),
      ...(photos > 0 ? [`${photos} ${photos === 1 ? 'photo' : 'photos'}`] : []),
    ]
    const uploaders = Array.from(
      new Set(added.map((a) => a.uploader).filter((u): u is string => Boolean(u)))
    ).slice(0, 3)

    await sendPushToAdmins({
      title: 'New from the floor',
      body:
        `${parts.join(' · ')} uploaded by the MA team` +
        (uploaders.length > 0 ? ` — ${uploaders.join(', ')}` : ''),
      url: `/videos?clinicId=${clinicId}&tab=floor`,
    })
  } catch (e) {
    console.warn(
      `floor: notify failed (non-fatal) — ${e instanceof Error ? e.message : 'unknown'}`
    )
  }
}
