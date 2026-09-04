import {
  getDriveClient,
  getUserDriveClient,
  getServiceAccountToken,
  getUserAccessToken,
  allowLinkView,
} from './drive'
import { Readable } from 'node:stream'

export interface UploadRecordingResult {
  fileId: string
  webViewLink: string
}

async function getOrCreateFolder(
  parentId: string | null,
  name: string,
  opts: { linkViewOnCreate?: boolean } = {}
): Promise<string> {
  const drive = getUserDriveClient() ?? getDriveClient()
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
  const id = created.data.id!
  // The doctor gets a direct link to this folder (/videos, doctor guide
  // PDF) and may not be signed into any Google account — same unlisted-link
  // decision as for the files themselves (2026-07-23, extended 2026-09-03).
  if (opts.linkViewOnCreate) await allowLinkView(id).catch(() => {})
  return id
}

// clinicName → per-clinic Recordings folder id. The folder is stable once
// created, so one Drive round-trip per clinic per server instance is enough —
// /videos calls this on every doctor page load.
const recordingsFolderCache = new Map<string, string>()

// The recordings root is a folder in a personal Drive, and whose Drive that
// is changed on 2026-09-03: the app now runs on a kinnil.official token,
// which cannot see the hellosystems111-owned folder DRIVE_RECORDINGS_ROOT_FOLDER_ID
// still points at. Every save then died in the folder lookup with a bare
// Drive 404 ("File not found: <id>") before a byte left the phone. Probe the
// configured root once per instance and fall back to the Drive root the app
// itself owns — GOOGLE_DRIVE_FOLDER_ID, which already holds a Recordings
// folder — so a mis-shared root degrades into the wrong folder, never into
// a doctor losing a take.
let recordingsRootPromise: Promise<string> | null = null

async function resolveRecordingsRootId(): Promise<string> {
  if (recordingsRootPromise) return recordingsRootPromise

  const configured = process.env.DRIVE_RECORDINGS_ROOT_FOLDER_ID
  const fallback = process.env.GOOGLE_DRIVE_FOLDER_ID
  if (!configured && !fallback) {
    throw new Error(
      'DRIVE_RECORDINGS_ROOT_FOLDER_ID is not set. ' +
      'Create a folder in your Google Drive, share it with the service account (Editor), ' +
      'and set this env var to its folder ID.'
    )
  }

  recordingsRootPromise = (async () => {
    if (!configured) return fallback!
    const drive = getUserDriveClient() ?? getDriveClient()
    try {
      await drive.files.get({ fileId: configured, fields: 'id', supportsAllDrives: true })
      return configured
    } catch (e) {
      const code = (e as { code?: number }).code
      if ((code === 404 || code === 403) && fallback) {
        console.warn(
          `[recordings] DRIVE_RECORDINGS_ROOT_FOLDER_ID (${configured}) is not readable by ` +
          `the Drive account this deploy runs as (${code}); using GOOGLE_DRIVE_FOLDER_ID ` +
          `(${fallback}) instead. Share the configured root with that account, or repoint the env var.`
        )
        return fallback
      }
      throw e
    }
  })()

  try {
    return await recordingsRootPromise
  } catch (e) {
    recordingsRootPromise = null // a transient failure must not stick
    throw e
  }
}

// Resolve (creating if needed) the clinic's teleprompter-recordings folder —
// <DRIVE_RECORDINGS_ROOT>/Recordings/<clinicName> — so the doctor can be
// handed a direct Drive folder link. Null when Drive isn't configured or
// the lookup fails: callers render no link instead of erroring the page.
export async function getClinicRecordingsFolderId(
  clinicName: string
): Promise<string | null> {
  const cached = recordingsFolderCache.get(clinicName)
  if (cached) return cached
  try {
    const rootId = await resolveRecordingsRootId()
    const recordingsParentId = await getOrCreateFolder(rootId, 'Recordings')
    const id = await getOrCreateFolder(recordingsParentId, clinicName, {
      linkViewOnCreate: true,
    })
    recordingsFolderCache.set(clinicName, id)
    return id
  } catch {
    return null
  }
}

export async function uploadRecording(
  clinicName: string,
  filename: string,
  buffer: Buffer,
  mimeType: string
): Promise<UploadRecordingResult> {
  // Prefer user OAuth client (personal Gmail). Falls back to SA (Shared Drive / DWD setups).
  const drive = getUserDriveClient() ?? getDriveClient()

  // Structure: DRIVE_RECORDINGS_ROOT_FOLDER_ID → {clinicName} → file
  // This MUST be a folder in a personal Google Drive shared with the SA (Editor).
  // Service accounts have no storage quota — files must live in a user-owned folder.
  const contentMachineId = await resolveRecordingsRootId()
  const recordingsParentId = await getOrCreateFolder(contentMachineId, 'Recordings')
  const clinicFolderId = await getOrCreateFolder(recordingsParentId, clinicName, {
    linkViewOnCreate: true,
  })

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
  mimeType: string,
  clientOrigin = ''
): Promise<{ uploadUrl: string }> {
  const contentMachineId = await resolveRecordingsRootId()
  const recordingsParentId = await getOrCreateFolder(contentMachineId, 'Recordings')
  const clinicFolderId = await getOrCreateFolder(recordingsParentId, clinicName, {
    linkViewOnCreate: true,
  })

  // User OAuth first — the recordings root lives in the user's
  // personal Drive, which the service account can't see (the SA
  // token here caused "Drive session init failed (404)").
  const token =
    (await getUserAccessToken().catch(() => null)) ??
    (await getServiceAccountToken())

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
        // Origin tells Drive to allow CORS on the upload URL so the browser XHR can PUT directly
        ...(clientOrigin ? { Origin: clientOrigin } : {}),
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

// Same client preference as uploads (user OAuth first): a file created by
// the user client is owned by that account, and Drive lets only the owner
// hard-delete it — the service account would get a 403. If the hard delete
// is still refused (e.g. SA-only setup on someone else's folder), trash it;
// gone from the doctor's library either way.
export async function deleteRecordingFromDrive(fileId: string): Promise<void> {
  const drive = getUserDriveClient() ?? getDriveClient()
  try {
    await drive.files.delete({ fileId, supportsAllDrives: true })
  } catch (e) {
    const status = (e as { code?: number }).code
    if (status === 404) return // already gone
    await drive.files.update({
      fileId,
      requestBody: { trashed: true },
      supportsAllDrives: true,
    })
  }
}
