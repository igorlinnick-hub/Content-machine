import { getDriveClient, getServiceAccountToken } from './drive'
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

  // Structure: DRIVE_RECORDINGS_ROOT_FOLDER_ID → Recordings → {clinicName} → file
  // If env var not set, falls back to Drive root → Recordings → {clinicName}
  const contentMachineId = process.env.DRIVE_RECORDINGS_ROOT_FOLDER_ID ?? null
  const recordingsParentId = await getOrCreateFolder(contentMachineId, 'Recordings')
  const clinicFolderId = await getOrCreateFolder(recordingsParentId, clinicName)

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

// Creates a Google Drive resumable upload session and returns the session URL.
// The client can PUT the video blob directly to this URL — Google handles
// the transfer, Vercel never sees the bytes. No file size limit applies.
//
// After the PUT, Drive returns JSON with { id, webViewLink } which the client
// parses and sends to /api/studio/recordings/confirm to save metadata.
export async function createUploadSession(
  clinicName: string,
  filename: string,
  mimeType: string
): Promise<{ uploadUrl: string }> {
  const contentMachineId = process.env.DRIVE_RECORDINGS_ROOT_FOLDER_ID ?? null
  const recordingsParentId = await getOrCreateFolder(contentMachineId, 'Recordings')
  const clinicFolderId = await getOrCreateFolder(recordingsParentId, clinicName)

  const token = await getServiceAccountToken()

  // Initiate resumable upload session via raw fetch — googleapis library
  // doesn't expose the session URI directly.
  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': mimeType,
      },
      body: JSON.stringify({
        name: filename,
        parents: [clinicFolderId],
      }),
    }
  )

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Drive session init failed (${res.status}): ${body}`)
  }

  const uploadUrl = res.headers.get('Location')
  if (!uploadUrl) throw new Error('Drive did not return a session URL')

  return { uploadUrl }
}

export async function deleteRecordingFromDrive(fileId: string): Promise<void> {
  const drive = getDriveClient()
  await drive.files.delete({ fileId, supportsAllDrives: true })
}
