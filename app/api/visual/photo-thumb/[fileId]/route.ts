import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { getPhotoBytes } from '@/lib/google/drive'

export const runtime = 'nodejs'

// GET → stream a Drive image through our server. Used by the
// PhotoPicker modal grid so admins can see the actual photos before
// picking. Admin-only; we trust the admin scope and do not enforce
// clinic ownership here (would add a Drive folder ⇆ clinic lookup
// on every render and slow the modal). Cache aggressively client-side.
export async function GET(
  _req: Request,
  { params }: { params: { fileId: string } }
) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }
  const fileId = params.fileId
  if (!fileId) {
    return NextResponse.json({ error: 'fileId required' }, { status: 400 })
  }

  const bytes = await getPhotoBytes(fileId)
  if (!bytes) {
    return NextResponse.json({ error: 'drive fetch failed' }, { status: 404 })
  }

  return new Response(new Uint8Array(bytes.data), {
    status: 200,
    headers: {
      'content-type': bytes.mimeType,
      'cache-control': 'private, max-age=600',
    },
  })
}
