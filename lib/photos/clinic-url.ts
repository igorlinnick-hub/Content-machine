import { createHmac, timingSafeEqual } from 'node:crypto'

// Public, signed URL for one clinic photo.
//
// Canva's upload-asset-from-url fetches the image from the open
// internet, and Drive does not serve bytes to an anonymous fetch — so
// the photo has to come through us. This is that door: a public route
// that streams a single Drive file, gated by an HMAC over the file id
// so nobody can walk the rest of the clinic's Drive with it.
//
// Deliberately NOT time-limited. The signed URL is stored inside the
// post plan and a post may sit in the queue for days; an expiring link
// would rot in the row. The exposure is one marketing photo that is on
// its way to Instagram anyway, and the signature still makes the URL
// unguessable and non-enumerable.

function signingKey(): string | null {
  return process.env.CONTENT_MACHINE_SECRET?.trim() || null
}

export function signPhotoId(fileId: string): string | null {
  const key = signingKey()
  if (!key) return null
  return createHmac('sha256', key).update(`clinic-photo:${fileId}`).digest('hex').slice(0, 32)
}

export function verifyPhotoSignature(fileId: string, sig: string): boolean {
  const expected = signPhotoId(fileId)
  if (!expected || !sig || sig.length !== expected.length) return false
  // Constant-time — a fast-fail compare leaks the signature byte by byte.
  return timingSafeEqual(Buffer.from(expected), Buffer.from(sig))
}

function baseUrl(): string | null {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
  )
}

/**
 * Absolute URL the Canva runner (or the in-house renderer) can fetch.
 * Null when the app URL or the signing secret is not configured —
 * callers degrade the slide rather than emitting a broken link.
 */
export function clinicPhotoUrl(fileId: string): string | null {
  const base = baseUrl()
  const sig = signPhotoId(fileId)
  if (!base || !sig) return null
  return `${base.replace(/\/$/, '')}/api/photos/clinic/${encodeURIComponent(fileId)}?sig=${sig}`
}
