import { google } from 'googleapis'
import type { drive_v3 } from 'googleapis'
import { Readable } from 'node:stream'

// Full Drive scope so the SA can also write — needed for the /clips
// pipeline (creating per-clip subfolders, uploading cleaned mp4 +
// .srt + transcript, moving the original out of Inbox). Photos
// pipeline only reads, but we lift the scope at the auth client
// level so we don't need two clients.
const SCOPES = ['https://www.googleapis.com/auth/drive']

export interface Photo {
  id: string
  name: string
  mimeType: string
  webContentLink: string | null
  thumbnailLink: string | null
}

function readCredentials(): { email: string; privateKey: string } {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const rawKey = process.env.GOOGLE_PRIVATE_KEY
  if (!email || !rawKey) {
    throw new Error(
      'Google Drive not configured: set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY'
    )
  }
  const privateKey = rawKey.replace(/\\n/g, '\n')
  return { email, privateKey }
}

// If GOOGLE_DRIVE_IMPERSONATE_EMAIL is set, the SA acts on behalf of that user
// (domain-wide delegation). Files count against that user's Drive quota instead
// of the SA (which has zero quota). Requires DWD enabled in Google Workspace admin.
// Alternative to Shared Drives for personal/Workspace Drive setups.
function getAuth() {
  const { email, privateKey } = readCredentials()
  const subject = process.env.GOOGLE_DRIVE_IMPERSONATE_EMAIL || undefined
  return new google.auth.JWT({ email, key: privateKey, scopes: SCOPES, subject })
}

let _drive: drive_v3.Drive | null = null

function driveClient(): drive_v3.Drive {
  if (!_drive) _drive = google.drive({ version: 'v3', auth: getAuth() })
  return _drive
}

// Recursive photo walk. Lists photos directly inside `folderId`, then
// descends into any subfolders (one level — enough for our use, avoids
// runaway). Used so admins can either drop photos straight into a
// category folder OR organise them in topic-named subfolders inside it.
export async function getPhotosFromFolder(folderId: string): Promise<Photo[]> {
  const drive = driveClient()

  async function listPhotosIn(parentId: string): Promise<Photo[]> {
    const q = `'${parentId}' in parents and mimeType contains 'image/' and trashed = false`
    const res = await drive.files.list({
      q,
      fields: 'files(id, name, mimeType, webContentLink, thumbnailLink)',
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })
    return (res.data.files ?? []).map((f) => ({
      id: f.id ?? '',
      name: f.name ?? '',
      mimeType: f.mimeType ?? '',
      webContentLink: f.webContentLink ?? null,
      thumbnailLink: f.thumbnailLink ?? null,
    }))
  }

  async function listSubfolders(parentId: string): Promise<string[]> {
    const q = `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
    const res = await drive.files.list({
      q,
      fields: 'files(id)',
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })
    return (res.data.files ?? []).map((f) => f.id ?? '').filter(Boolean)
  }

  const direct = await listPhotosIn(folderId)
  const subfolders = await listSubfolders(folderId)
  if (subfolders.length === 0) return direct

  const nested = await Promise.all(subfolders.map((id) => listPhotosIn(id)))
  return [...direct, ...nested.flat()]
}

// Internal: expose the underlying Drive client so other modules
// (clips pipeline) can do non-photo operations without re-auth.
export function getDriveClient(): drive_v3.Drive {
  return driveClient()
}

// Short-lived OAuth2 access token for the service account.
// Used by the resumable-upload flow where the client PUTs directly
// to googleapis.com and needs a bearer token for CORS.
export async function getServiceAccountToken(): Promise<string> {
  const auth = getAuth()
  const res = await auth.getAccessToken()
  return res.token ?? ''
}

// Fetch a Drive image as raw bytes + mime type. Used by the vision
// photo indexer (needs un-base64'd bytes for the Anthropic SDK) and as
// the underlying primitive of getPhotoDataUrl. Returns null on any
// Drive error — keeps callers simple.
export async function getPhotoBytes(
  fileId: string
): Promise<{ data: Buffer; mimeType: string } | null> {
  try {
    const drive = driveClient()
    const meta = await drive.files.get({
      fileId,
      fields: 'mimeType',
      supportsAllDrives: true,
    })
    const mime = meta.data.mimeType ?? 'image/jpeg'
    const res = await drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'arraybuffer' }
    )
    return { data: Buffer.from(res.data as ArrayBuffer), mimeType: mime }
  } catch {
    return null
  }
}

// Fetch a Drive image as a base64 data URL via the SA. Works for files
// shared with the SA regardless of public-link sharing — bytes flow
// through our server. Used by the renderer when it needs an image URL
// puppeteer can resolve without Drive auth (which it can't).
export async function getPhotoDataUrl(fileId: string): Promise<string | null> {
  const bytes = await getPhotoBytes(fileId)
  if (!bytes) return null
  return `data:${bytes.mimeType};base64,${bytes.data.toString('base64')}`
}
