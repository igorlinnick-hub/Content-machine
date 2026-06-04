import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { disabledHttpResponse } from '@/lib/agents/disabled'
import { getPhotosFromFolder, getPhotoBytes } from '@/lib/google/drive'
import {
  listIndexedFileIds,
  upsertPhotoIndex,
} from '@/lib/visual/photo-index-store'
import { runPhotoIndexer } from '@/lib/agents/photo-indexer'

export const runtime = 'nodejs'
// Vision per photo is ~2-4s. A 25-photo folder fits comfortably under
// 90s; the route caps the per-call batch below.
export const maxDuration = 90

interface Body {
  clinicId?: string
  driveFolderId?: string
  // Force re-index even if a row already exists. Default false — we
  // skip indexed files to keep cost predictable on repeat clicks.
  force?: boolean
  // Hard cap on how many photos this single call indexes. Default 8.
  // Small batches let the UI show progress between calls — caller is
  // expected to loop until response.remaining === 0.
  limit?: number
}

const MIME_MAP: Record<string, 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'> = {
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
  'image/gif': 'image/gif',
}

// POST → index up to `limit` photos in the Drive folder, skipping any
// that already have a fresh row in photo_index. Returns counts so the
// UI can show "12 newly indexed, 30 already known".
export async function POST(req: Request) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }
  const off = await disabledHttpResponse()
  if (off) return off

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }
  const clinicId = body.clinicId?.trim()
  const driveFolderId = body.driveFolderId?.trim()
  if (!clinicId || !driveFolderId) {
    return NextResponse.json(
      { error: 'clinicId and driveFolderId are required' },
      { status: 400 }
    )
  }
  const limit = Math.max(1, Math.min(body.limit ?? 8, 20))

  let allPhotos
  try {
    allPhotos = await getPhotosFromFolder(driveFolderId)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'drive list failed'
    return NextResponse.json({ error: `drive: ${msg}` }, { status: 500 })
  }
  if (allPhotos.length === 0) {
    return NextResponse.json({ indexed: 0, skipped: 0, total: 0 })
  }

  let alreadyIndexed: Set<string>
  try {
    alreadyIndexed = body.force
      ? new Set<string>()
      : await listIndexedFileIds(clinicId, driveFolderId)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'photo_index unavailable'
    const tableMissing = /does not exist|relation .* does not exist/i.test(msg)
    return NextResponse.json(
      {
        indexed: 0,
        skipped: 0,
        total: allPhotos.length,
        reason: tableMissing ? 'migration_019_required' : 'photo_index_error',
        error: tableMissing ? null : msg,
      },
      { status: tableMissing ? 200 : 500 }
    )
  }

  const todo = allPhotos
    .filter((p) => !alreadyIndexed.has(p.id))
    .slice(0, limit)

  let indexed = 0
  const errors: { drive_file_id: string; error: string }[] = []

  for (const photo of todo) {
    try {
      const bytes = await getPhotoBytes(photo.id)
      if (!bytes) {
        errors.push({ drive_file_id: photo.id, error: 'drive fetch returned null' })
        continue
      }
      const mediaType = MIME_MAP[bytes.mimeType.toLowerCase()] ?? 'image/jpeg'
      const result = await runPhotoIndexer({
        image: { data: bytes.data, mediaType },
      })
      await upsertPhotoIndex({
        clinic_id: clinicId,
        drive_folder_id: driveFolderId,
        drive_file_id: photo.id,
        file_name: photo.name,
        description: result.description,
        tags: result.tags,
        description_model: result.model,
      })
      indexed += 1
    } catch (e) {
      errors.push({
        drive_file_id: photo.id,
        error: e instanceof Error ? e.message : 'unknown',
      })
    }
  }

  return NextResponse.json({
    indexed,
    skipped: allPhotos.length - todo.length,
    total: allPhotos.length,
    remaining: Math.max(0, allPhotos.length - alreadyIndexed.size - indexed),
    errors: errors.slice(0, 10),
  })
}
