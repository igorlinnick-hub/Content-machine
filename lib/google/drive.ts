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

export async function getPhotosFromFolder(folderId: string): Promise<Photo[]> {
  const drive = driveClient()
  const q = `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`
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
