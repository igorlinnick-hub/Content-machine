import { google } from 'googleapis'
import type { drive_v3 } from 'googleapis'

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

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

function getAuth() {
  const { email, privateKey } = readCredentials()
  return new google.auth.JWT({ email, key: privateKey, scopes: SCOPES })
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

// Fetch a Drive image as a base64 data URL via the SA. Works for files
// shared with the SA regardless of public-link sharing — bytes flow
// through our server. Used by the renderer when it needs an image URL
// puppeteer can resolve without Drive auth (which it can't).
export async function getPhotoDataUrl(fileId: string): Promise<string | null> {
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
    const buf = Buffer.from(res.data as ArrayBuffer)
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}
