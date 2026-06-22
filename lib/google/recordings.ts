import { getDriveClient } from './drive'
import { Readable } from 'node:stream'

export interface UploadRecordingResult {
  fileId: string
  webViewLink: string
}

async function getOrCreateFolder(
  parentId: string | null,
  name: string
): Promise<string> {
  const drive = getDriveClient()
  const parentClause = parentId ? `'${parentId}' in parents` : `'root' in parents`
  const q = `mimeType = 'application/vnd.google-apps.folder' and name = '${name.replace(/'/g, "\\'")}' and trashed = false and ${parentClause}`

  const existing = await drive.files.list({
    q,
    fields: 'files(id)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  const found = existing.data.files?.[0]?.id
  if (found) return found

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentId ? { parents: [parentId] } : {}),
    },
    fields: 'id',
    supportsAllDrives: true,
  })
  return created.data.id!
}

export async function uploadRecording(
  clinicName: string,
  filename: string,
  buffer: Buffer,
  mimeType: string
): Promise<UploadRecordingResult> {
  const drive = getDriveClient()

  // If DRIVE_RECORDINGS_ROOT_FOLDER_ID is set, use it as the parent for
  // the per-clinic subfolder. Otherwise create at Drive root.
  const rootFolderId = process.env.DRIVE_RECORDINGS_ROOT_FOLDER_ID ?? null
  const clinicFolderId = await getOrCreateFolder(rootFolderId, clinicName)

  const readable = Readable.from(buffer)
  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [clinicFolderId],
    },
    media: { mimeType, body: readable },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  })

  return {
    fileId: res.data.id!,
    webViewLink: res.data.webViewLink ?? '',
  }
}

export async function deleteRecordingFromDrive(fileId: string): Promise<void> {
  const drive = getDriveClient()
  await drive.files.delete({ fileId, supportsAllDrives: true })
}
