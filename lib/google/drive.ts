import { google } from 'googleapis'
import type { drive_v3 } from 'googleapis'
import { Readable } from 'node:stream'

const SCOPES = ['https://www.googleapis.com/auth/drive']

// Returns an OAuth2 Drive client using the user's personal refresh token.
// Required for personal Gmail accounts — service accounts have zero storage
// quota and can't create files in personal Drive. Set GOOGLE_DRIVE_USER_REFRESH_TOKEN
// (one-time setup via scripts/get-drive-token.mjs) and add Client ID/Secret:
//   GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET
export function getUserDriveClient(): drive_v3.Drive | null {
  const refreshToken = process.env.GOOGLE_DRIVE_USER_REFRESH_TOKEN
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!refreshToken || !clientId || !clientSecret) return null
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret)
  oauth2.setCredentials({ refresh_token: refreshToken })
  return google.drive({ version: 'v3', auth: oauth2 })
}

// Raw access token for the user's OAuth client — for endpoints we
// call with plain fetch (e.g. Drive resumable upload sessions) where
// the googleapis client can't be used. Null when user OAuth env is
// not configured.
export async function getUserAccessToken(): Promise<string | null> {
  const refreshToken = process.env.GOOGLE_DRIVE_USER_REFRESH_TOKEN
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!refreshToken || !clientId || !clientSecret) return null
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret)
  oauth2.setCredentials({ refresh_token: refreshToken })
  const { token } = await oauth2.getAccessToken()
  return token ?? null
}

// "Anyone with the link can view" — required for the in-app Drive
// preview iframes (/clips): files created by the user-OAuth client
// are private, and the viewer's browser may be signed into a
// different Google account. Unlisted-link exposure is accepted for
// clinic raw/cleaned videos (decided 2026-07-23).
export async function allowLinkView(fileId: string): Promise<void> {
  const drive = getUserDriveClient() ?? getDriveClient()
  await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
    supportsAllDrives: true,
  })
}

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

// Formats a slide can actually use. `mimeType contains 'image/'` was too
// wide: Sony RAW registers as image/x-sony-arw, and the clinic's Drive
// folders are full of 25 MB .ARW files that Canva can't upload, Vision
// can't describe and Instagram can't post (Igor 2026-08-17).
const USABLE_IMAGE_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]

// Recursive photo walk, TWO levels deep. Admins can drop photos straight
// into the folder, organise them in topic subfolders, OR (the clinic
// library) point us at a root whose subfolders themselves hold subfolders.
export async function getPhotosFromFolder(folderId: string): Promise<Photo[]> {
  const drive = driveClient()

  async function listPhotosIn(parentId: string): Promise<Photo[]> {
    const mimeClause = USABLE_IMAGE_MIMES.map((m) => `mimeType = '${m}'`).join(' or ')
    const q = `'${parentId}' in parents and (${mimeClause}) and trashed = false`
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

  // Level 1 + level 2. Two levels covers "root → topic folder → shoot
  // folder" without risking a runaway walk of someone's whole Drive.
  const level1 = await Promise.all(
    subfolders.map(async (id) => {
      const photos = await listPhotosIn(id)
      const deeper = await listSubfolders(id)
      if (deeper.length === 0) return photos
      const level2 = await Promise.all(deeper.map((sub) => listPhotosIn(sub)))
      return [...photos, ...level2.flat()]
    })
  )

  // The same file can be reachable twice (shortcuts, nested duplicates) —
  // dedupe so the rotation counter doesn't treat one photo as two.
  const seen = new Set<string>()
  return [...direct, ...level1.flat()].filter((p) => {
    if (!p.id || seen.has(p.id)) return false
    seen.add(p.id)
    return true
  })
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
// The vision API rejects anything over 10 MB of base64, and the clinic
// library is full of 20-28 MB edited PNGs (15 of 137 on the first index
// run). Over this threshold we describe Drive's own downscaled render
// instead of the original — a 1600px JPEG is more than enough to say
// what is in the frame (Igor 2026-08-18).
const VISION_BYTE_LIMIT = 7_000_000

// Drive returns the thumbnail in the source format, not always JPEG, and
// the vision API rejects a payload whose declared media type disagrees
// with the bytes. Read the format off the magic number instead of
// assuming.
function sniffImageMime(buf: Buffer): string | null {
  if (buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.toString('ascii', 1, 4) === 'PNG') return 'image/png'
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp'
  }
  return null
}

export async function getPhotoBytes(
  fileId: string,
  opts: { downscaleOverLimit?: boolean } = {}
): Promise<{ data: Buffer; mimeType: string } | null> {
  try {
    const drive = driveClient()
    const meta = await drive.files.get({
      fileId,
      fields: 'mimeType, size, thumbnailLink',
      supportsAllDrives: true,
    })
    const mime = meta.data.mimeType ?? 'image/jpeg'
    const size = Number(meta.data.size ?? 0)

    if (opts.downscaleOverLimit && size > VISION_BYTE_LIMIT) {
      const thumb = meta.data.thumbnailLink
      if (thumb) {
        // Drive's thumbnail URL carries its own size suffix (=s220);
        // asking for s1600 returns a JPEG big enough to describe.
        const big = thumb.replace(/=s\d+(-c)?$/, '=s1600')
        const res = await fetch(big)
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer())
          if (buf.byteLength <= VISION_BYTE_LIMIT) {
            return { data: buf, mimeType: sniffImageMime(buf) ?? mime }
          }
        }
      }
      // No usable thumbnail: better to report nothing than to send a
      // payload the API will reject.
      return null
    }

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
