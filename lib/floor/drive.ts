import { getDriveClient, getUserDriveClient } from '@/lib/google/drive'

// Drive reads for the "From the floor" mirror — the folder a clinic's
// Google Form writes into when a medical assistant submits photos and
// clips (see the MA handout: one form, a slot for photos and a slot
// for video clips).
//
// Layout Google Forms creates, and why the walk is recursive:
//   "<Form title> (File responses)"/        <- what the admin pastes
//     "Photos (File responses)"/            <- one per upload question
//       IMG_0421 - Kaila M.jpg              <- " - <respondent>" suffix
//     "Video clips (File responses)"/
//       IMG_0422 - Kaila M.mov
// Pasting either level works: we walk down from whatever id we're given.

// Same client preference as the clips pipeline: the user's OAuth
// client owns the form folder; the service account is the fallback
// for Shared-Drive / DWD setups.
function driveClient() {
  return getUserDriveClient() ?? getDriveClient()
}

export interface FloorFile {
  id: string
  name: string
  mimeType: string
  kind: 'photo' | 'video'
  size: number | null
  width: number | null
  height: number | null
  durationSec: number | null
  folderName: string | null
  createdTime: string
}

const FOLDER_MIME = 'application/vnd.google-apps.folder'
// Guard rails for a folder that has been collecting for a year:
// the sync is a cron/page-load operation, not a batch job.
const MAX_FOLDERS = 25
export const FLOOR_FILE_CAP = 500
const MAX_FILES = FLOOR_FILE_CAP

// Accepts a full Drive URL or a bare id — the admin pastes whatever
// the browser gave them.
export function parseDriveFolderId(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null
  const patterns = [
    /\/folders\/([a-zA-Z0-9_-]{10,})/, // .../drive/folders/<id>
    /[?&]id=([a-zA-Z0-9_-]{10,})/, // open?id=<id>
  ]
  for (const re of patterns) {
    const m = raw.match(re)
    if (m) return m[1]
  }
  return /^[a-zA-Z0-9_-]{10,}$/.test(raw) ? raw : null
}

function kindOf(mimeType: string, name: string): 'photo' | 'video' | null {
  if (mimeType.startsWith('image/')) return 'photo'
  if (mimeType.startsWith('video/')) return 'video'
  // Drive occasionally hands back application/octet-stream for a .mov
  // straight off an iPhone.
  if (/\.(mov|mp4|m4v|hevc|avi)$/i.test(name)) return 'video'
  if (/\.(jpe?g|png|heic|heif|webp)$/i.test(name)) return 'photo'
  return null
}

// Google Forms appends " - <Respondent name>" to every uploaded file.
// Split it off so the gallery can credit the MA and show a clean name.
export function splitUploader(fileName: string): {
  title: string
  uploader: string | null
} {
  const withoutExt = fileName.replace(/\.[a-z0-9]{2,5}$/i, '')
  const idx = withoutExt.lastIndexOf(' - ')
  if (idx <= 0) return { title: withoutExt, uploader: null }
  const uploader = withoutExt.slice(idx + 3).trim()
  // A trailing "- 2" or a hyphenated filename is not a person.
  if (!uploader || uploader.length > 60 || /^\d+$/.test(uploader)) {
    return { title: withoutExt, uploader: null }
  }
  return { title: withoutExt.slice(0, idx).trim() || withoutExt, uploader }
}

async function listChildren(folderId: string) {
  const drive = driveClient()
  const files = []
  let pageToken: string | undefined
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields:
        'nextPageToken, files(id, name, mimeType, size, createdTime, imageMediaMetadata(width,height), videoMediaMetadata(width,height,durationMillis))',
      orderBy: 'createdTime desc',
      pageSize: 200,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })
    files.push(...(res.data.files ?? []))
    pageToken = res.data.nextPageToken ?? undefined
  } while (pageToken && files.length < MAX_FILES)
  return files
}

// Every photo/clip under the folder, newest first. Subfolders are
// walked breadth-first (Forms nests exactly one level, but a clinic
// that tidies its folder into months still works).
export async function listFloorFiles(rootFolderId: string): Promise<FloorFile[]> {
  const queue: Array<{ id: string; name: string | null }> = [
    { id: rootFolderId, name: null },
  ]
  const seenFolders = new Set<string>([rootFolderId])
  const out: FloorFile[] = []

  while (queue.length > 0 && seenFolders.size <= MAX_FOLDERS && out.length < MAX_FILES) {
    const folder = queue.shift()!
    const children = await listChildren(folder.id)
    for (const f of children) {
      if (!f.id || !f.name) continue
      if (f.mimeType === FOLDER_MIME) {
        if (!seenFolders.has(f.id) && seenFolders.size < MAX_FOLDERS) {
          seenFolders.add(f.id)
          // Strip the "(File responses)" tail Forms adds to the label.
          queue.push({ id: f.id, name: f.name.replace(/\s*\(File responses\)\s*$/i, '') })
        }
        continue
      }
      const kind = kindOf(f.mimeType ?? '', f.name)
      if (!kind) continue
      const durationMs = f.videoMediaMetadata?.durationMillis
      out.push({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType ?? (kind === 'video' ? 'video/mp4' : 'image/jpeg'),
        kind,
        size: typeof f.size === 'string' ? parseInt(f.size, 10) || null : null,
        width: f.imageMediaMetadata?.width ?? f.videoMediaMetadata?.width ?? null,
        height: f.imageMediaMetadata?.height ?? f.videoMediaMetadata?.height ?? null,
        durationSec: durationMs ? Math.round(Number(durationMs) / 100) / 10 : null,
        folderName: folder.name,
        createdTime: f.createdTime ?? new Date().toISOString(),
      })
      if (out.length >= MAX_FILES) break
    }
  }

  return out.sort(
    (a, b) => Date.parse(b.createdTime) - Date.parse(a.createdTime)
  )
}

// Folder name + a quick reachability check, for the "connect a
// folder" screen: a paste of the wrong id should fail there, not
// silently sync nothing.
export async function describeFolder(
  folderId: string
): Promise<{ id: string; name: string } | null> {
  try {
    const res = await driveClient().files.get({
      fileId: folderId,
      fields: 'id, name, mimeType',
      supportsAllDrives: true,
    })
    if (res.data.mimeType !== FOLDER_MIME) return null
    return { id: res.data.id ?? folderId, name: res.data.name ?? 'Drive folder' }
  } catch {
    return null
  }
}

// Stable, no-expiry preview URLs — the same pair /videos already uses.
export function floorThumbUrl(fileId: string): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`
}

export function floorDriveUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`
}
