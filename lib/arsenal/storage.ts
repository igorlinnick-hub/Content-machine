import { randomBytes } from 'crypto'
import { createServerClient } from '@/lib/supabase/server'

// Helpers around the `arsenal-videos` Supabase bucket.
//
// Two callers:
//   1. Vercel /api/arsenal/upload-url — issues a short-lived signed
//      upload URL so the local skill PUTs the mp4 directly (Vercel
//      function payload limits + Igor's residential bandwidth make a
//      pass-through upload painful).
//   2. Server-side reads — `publicUrl(path)` derives the playable URL
//      from the bucket key we stored in script_arsenal.

const BUCKET = 'arsenal-videos'

export interface UploadTargets {
  videoPath: string
  videoSignedUrl: string
  videoToken: string
  thumbnailPath: string
  thumbnailSignedUrl: string
  thumbnailToken: string
}

// Returns paths + signed upload URLs for both the mp4 and the
// thumbnail. The skill PUTs the bytes, then sends the paths back
// in /api/arsenal/draft. We pick the version suffix here so the
// path the skill uploads to is identical to the path we persist —
// avoids race conditions where the skill picks one and we pick another.
export async function createUploadTargets(
  clinicId: string,
  arsenalIdHint: string
): Promise<UploadTargets> {
  const supabase = createServerClient()
  const version = randomBytes(4).toString('hex')
  const base = `${clinicId}/${arsenalIdHint}_${version}`
  const videoPath = `${base}.mp4`
  const thumbnailPath = `${base}.jpg`

  // createSignedUploadUrl issues a token usable for ~2 hours; we don't
  // need finer expiry control since the skill consumes it immediately
  // after this call.
  const [video, thumb] = await Promise.all([
    supabase.storage.from(BUCKET).createSignedUploadUrl(videoPath),
    supabase.storage.from(BUCKET).createSignedUploadUrl(thumbnailPath),
  ])
  if (video.error || !video.data) {
    throw new Error(
      `signed url failed (video): ${video.error?.message ?? 'unknown'}`
    )
  }
  if (thumb.error || !thumb.data) {
    throw new Error(
      `signed url failed (thumb): ${thumb.error?.message ?? 'unknown'}`
    )
  }
  return {
    videoPath,
    videoSignedUrl: video.data.signedUrl,
    videoToken: video.data.token,
    thumbnailPath,
    thumbnailSignedUrl: thumb.data.signedUrl,
    thumbnailToken: thumb.data.token,
  }
}

// Derive the playable public URL from the persisted bucket key.
// Returns null for null input so callers can pipe straight through.
export function publicUrl(path: string | null): string | null {
  if (!path) return null
  const supabase = createServerClient()
  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return publicUrl
}

// Hard-delete the stored objects. Called when a row is dropped via
// Archy or the admin UI so the bucket doesn't grow with orphans.
export async function deleteArsenalObjects(
  videoPath: string | null,
  thumbnailPath: string | null
): Promise<void> {
  const paths = [videoPath, thumbnailPath].filter(
    (p): p is string => typeof p === 'string' && p.length > 0
  )
  if (paths.length === 0) return
  const supabase = createServerClient()
  await supabase.storage.from(BUCKET).remove(paths)
}
