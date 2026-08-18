import { NextResponse } from 'next/server'
import { getPhotoBytes } from '@/lib/google/drive'
import { verifyPhotoSignature } from '@/lib/photos/clinic-url'

// Streams ONE clinic photo from Drive to an anonymous caller — the
// Canva runner's upload-asset-from-url, or the in-house renderer.
// Public by necessity (Canva fetches server-side, unauthenticated) and
// safe only because of the signature: without a valid HMAC for that
// exact file id the route returns 403, so it can't be used as a general
// proxy into the clinic's Drive.
export const runtime = 'nodejs'

export async function GET(
  req: Request,
  { params }: { params: { fileId: string } }
) {
  const fileId = params.fileId
  const sig = new URL(req.url).searchParams.get('sig') ?? ''
  if (!verifyPhotoSignature(fileId, sig)) {
    return NextResponse.json({ error: 'bad signature' }, { status: 403 })
  }

  const bytes = await getPhotoBytes(fileId)
  if (!bytes) {
    return NextResponse.json({ error: 'photo not found or unreadable' }, { status: 404 })
  }

  return new Response(new Uint8Array(bytes.data), {
    headers: {
      'content-type': bytes.mimeType,
      'content-length': String(bytes.data.length),
      // The bytes behind a file id never change; Canva may refetch.
      'cache-control': 'public, max-age=86400, immutable',
    },
  })
}
