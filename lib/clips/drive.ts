import { Readable } from 'node:stream'
import { getDriveClient } from '@/lib/google/drive'

// Drive operations specific to the /clips pipeline. The doctor
// drops mp4/mov files in the Inbox folder; we download, process,
// and write artifacts into a per-clip subfolder.
//
// Two folder layouts coexist:
// 1. Legacy global (ids in env — HWC today):
//   Clips/
//     Inbox/        <- GOOGLE_DRIVE_CLIPS_INBOX_ID
//     Cleaned/      <- GOOGLE_DRIVE_CLIPS_CLEANED_ID
//       2026-05-09_TMS_intro/   (created by us, one per clip;
//         original moved in here too)
// 2. Per-clinic (ids on the clinics row — lib/google/clinicFolders.ts):
//   {Clinic — Doctor}/
//     Inbox/      <- doctor drops raw videos
//     Originals/  <- original moved here after processing
//     Finals/     <- per-clip folders with cleaned.mp4 + transcripts
// Every function takes optional explicit folder ids; omitted = env.

export interface InboxClip {
  id: string
  name: string
  mimeType: string
  size: number
  createdTime: string
}

export function readClipsEnv(): {
  inboxId: string
  cleanedId: string
} {
  const inboxId = process.env.GOOGLE_DRIVE_CLIPS_INBOX_ID
  const cleanedId = process.env.GOOGLE_DRIVE_CLIPS_CLEANED_ID
  if (!inboxId || !cleanedId) {
    throw new Error(
      'Clips pipeline not configured: set GOOGLE_DRIVE_CLIPS_INBOX_ID and GOOGLE_DRIVE_CLIPS_CLEANED_ID'
    )
  }
  return { inboxId, cleanedId }
}

export async function listInboxClips(
  explicitInboxId?: string
): Promise<InboxClip[]> {
  const inboxId = explicitInboxId ?? readClipsEnv().inboxId
  const drive = getDriveClient()
  const q = `'${inboxId}' in parents and (mimeType contains 'video/' or name contains '.mov') and trashed = false`
  const res = await drive.files.list({
    q,
    fields: 'files(id, name, mimeType, size, createdTime)',
    orderBy: 'createdTime asc',
    pageSize: 50,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  return (res.data.files ?? []).map((f) => ({
    id: f.id ?? '',
    name: f.name ?? '',
    mimeType: f.mimeType ?? '',
    size: typeof f.size === 'string' ? parseInt(f.size, 10) || 0 : 0,
    createdTime: f.createdTime ?? new Date().toISOString(),
  }))
}

export async function downloadDriveFileToBuffer(
  fileId: string
): Promise<Buffer> {
  const drive = getDriveClient()
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' }
  )
  return Buffer.from(res.data as ArrayBuffer)
}

export async function createClipFolder(
  name: string,
  explicitParentId?: string
): Promise<string> {
  const cleanedId = explicitParentId ?? readClipsEnv().cleanedId
  const drive = getDriveClient()
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [cleanedId],
    },
    fields: 'id',
    supportsAllDrives: true,
  })
  if (!res.data.id) throw new Error('createClipFolder: no id returned')
  return res.data.id
}

export async function uploadFileToFolder(params: {
  folderId: string
  name: string
  mimeType: string
  body: Buffer
}): Promise<string> {
  const drive = getDriveClient()
  const res = await drive.files.create({
    requestBody: {
      name: params.name,
      parents: [params.folderId],
      mimeType: params.mimeType,
    },
    media: {
      mimeType: params.mimeType,
      body: Readable.from(params.body),
    },
    fields: 'id',
    supportsAllDrives: true,
  })
  if (!res.data.id) throw new Error('uploadFileToFolder: no id returned')
  return res.data.id
}

// Copy a Drive file into a clips Inbox — the teleprompter Auto-edit
// path: the recording stays in Recordings/ untouched, the copy walks
// the normal Inbox pipeline. Returns the copy as an InboxClip so the
// caller can hand it straight to processClip.
export async function copyFileToInbox(
  fileId: string,
  inboxId: string
): Promise<InboxClip> {
  const drive = getDriveClient()
  const src = await drive.files.get({
    fileId,
    fields: 'name, mimeType',
    supportsAllDrives: true,
  })
  const res = await drive.files.copy({
    fileId,
    requestBody: {
      name: src.data.name ?? 'recording',
      parents: [inboxId],
    },
    fields: 'id, name, mimeType, size, createdTime',
    supportsAllDrives: true,
  })
  if (!res.data.id) throw new Error('copyFileToInbox: no id returned')
  return {
    id: res.data.id,
    name: res.data.name ?? src.data.name ?? 'recording',
    mimeType: res.data.mimeType ?? src.data.mimeType ?? 'video/mp4',
    size:
      typeof res.data.size === 'string'
        ? parseInt(res.data.size, 10) || 0
        : 0,
    createdTime: res.data.createdTime ?? new Date().toISOString(),
  }
}

// Move the original Inbox file out of the Inbox — into the per-clip
// folder (legacy layout) or the clinic's Originals/ (per-clinic
// layout) — so the Inbox stays clean.
export async function moveFileToFolder(
  fileId: string,
  newParentId: string,
  explicitFromParentId?: string
): Promise<void> {
  const inboxId = explicitFromParentId ?? readClipsEnv().inboxId
  const drive = getDriveClient()
  await drive.files.update({
    fileId,
    addParents: newParentId,
    removeParents: inboxId,
    fields: 'id, parents',
    supportsAllDrives: true,
  })
}

// Public folder URL the operator can click to see the artifacts.
export function clipFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`
}
