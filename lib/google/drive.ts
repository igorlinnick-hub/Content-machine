import { google } from 'googleapis'
import type { drive_v3, docs_v1 } from 'googleapis'

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/documents',
]

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
let _docs: docs_v1.Docs | null = null

function driveClient(): drive_v3.Drive {
  if (!_drive) _drive = google.drive({ version: 'v3', auth: getAuth() })
  return _drive
}

function docsClient(): docs_v1.Docs {
  if (!_docs) _docs = google.docs({ version: 'v1', auth: getAuth() })
  return _docs
}

function defaultFolderId(): string | undefined {
  return process.env.GOOGLE_DRIVE_FOLDER_ID || undefined
}

export async function createScriptDoc(
  script: string,
  title: string,
  folderId?: string
): Promise<{ docId: string; docUrl: string }> {
  const drive = driveClient()
  const docs = docsClient()

  const parent = folderId ?? defaultFolderId()
  const createRes = await drive.files.create({
    requestBody: {
      name: title,
      mimeType: 'application/vnd.google-apps.document',
      parents: parent ? [parent] : undefined,
    },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  })

  const docId = createRes.data.id
  if (!docId) throw new Error('createScriptDoc: Drive returned no file id')

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: [{ insertText: { location: { index: 1 }, text: script } }],
    },
  })

  const docUrl =
    createRes.data.webViewLink ?? `https://docs.google.com/document/d/${docId}/edit`

  return { docId, docUrl }
}

export async function readDocContent(docId: string): Promise<string> {
  const docs = docsClient()
  const res = await docs.documents.get({ documentId: docId })
  const body = res.data.body?.content ?? []
  const lines: string[] = []
  for (const el of body) {
    const para = el.paragraph
    if (!para?.elements) continue
    const line = para.elements
      .map((e) => e.textRun?.content ?? '')
      .join('')
    lines.push(line)
  }
  return lines.join('').replace(/\n{3,}/g, '\n\n').trim()
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

export async function uploadPNG(
  buffer: Buffer,
  filename: string,
  folderId?: string
): Promise<string> {
  const drive = driveClient()
  const parent = folderId ?? defaultFolderId()
  const { Readable } = await import('node:stream')

  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: parent ? [parent] : undefined,
    },
    media: {
      mimeType: 'image/png',
      body: Readable.from(buffer),
    },
    fields: 'id',
    supportsAllDrives: true,
  })

  if (!res.data.id) throw new Error('uploadPNG: Drive returned no file id')
  return res.data.id
}
