import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { callAgentVisionJSON, MODEL_HAIKU } from '@/lib/agents/base'
import { disabledHttpResponse } from '@/lib/agents/disabled'
import { getPhotoBytes, getPhotosFromFolder } from '@/lib/google/drive'
import {
  listIndexedFileIds,
  upsertPhotoIndex,
} from '@/lib/visual/photo-index-store'

// Indexes a Drive photo folder: describes every not-yet-described photo
// with Haiku Vision and writes it to photo_index. The description + tags
// are what the carousel photo matcher and the visual-post picker search
// against — an unindexed folder is invisible to both.
//
// Batched on purpose: one vision call per photo is slow, so the UI loops
// this endpoint with `limit` and shows progress between calls. The
// response shape (indexed / skipped / total / remaining) is the contract
// PhotoPicker.tsx has always expected — the route itself was never
// written until 2026-08-17.
export const runtime = 'nodejs'
export const maxDuration = 300

const DEFAULT_LIMIT = 8

// The vision API takes these four. HEIC/HEIF pass the Drive filter (a
// phone photo is a legitimate library photo) but cannot be sent as-is.
const VISION_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
type VisionMime = (typeof VISION_MIMES)[number]

const SYSTEM_PROMPT = `You describe photographs from a medical wellness clinic's own library so they can later be matched to the right slide of a social post.

Return TWO things:
  "description" — 1-2 plain sentences: who or what is in frame, where it is, what is happening, the mood. Concrete and literal. No marketing adjectives, no invented clinic names, no guesses about medical conditions.
  "tags" — 4-8 short lowercase keywords a person would search by: subjects (doctor, team, patient, hands, building, reception, treatment room), objects (laser, iv drip, ultrasound, chair, plant), setting (indoor, outdoor, beach, office), and framing (portrait, wide, close-up, over-the-shoulder).

If a face is clearly identifiable, add the tag "identifiable-face" — those photos need a signed media release before they can ship.

Respond with ONLY valid JSON, no markdown fences:
{"description": "...", "tags": ["...", "..."]}`

interface IndexedPhoto {
  description: string
  tags: string[]
}

export async function POST(req: Request) {
  const disabled = await disabledHttpResponse()
  if (disabled) return disabled

  const access = await resolveAccess()
  if (!access) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  let body: { clinicId?: string; driveFolderId?: string; limit?: number }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  // A doctor may only index their own clinic; admin passes it explicitly.
  const clinicId = access.role === 'admin' ? body.clinicId ?? '' : access.clinicId
  const driveFolderId = body.driveFolderId?.trim() ?? ''
  if (!clinicId) return NextResponse.json({ error: 'clinicId required' }, { status: 400 })
  if (!driveFolderId) {
    return NextResponse.json({ error: 'driveFolderId required' }, { status: 400 })
  }
  const limit = Math.min(Math.max(body.limit ?? DEFAULT_LIMIT, 1), 25)

  let photos: Awaited<ReturnType<typeof getPhotosFromFolder>>
  try {
    photos = await getPhotosFromFolder(driveFolderId)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'drive list failed'
    // The overwhelmingly common cause: the folder was never shared with
    // the service account. Say so instead of leaking a raw Google error.
    return NextResponse.json(
      {
        error: `Drive folder unreadable: ${msg}. Share it with ${
          process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? 'the service account'
        } as a reader.`,
      },
      { status: 502 }
    )
  }

  let already: Set<string>
  try {
    already = await listIndexedFileIds(clinicId, driveFolderId)
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (/photo_index/i.test(msg) && /does not exist|schema cache/i.test(msg)) {
      return NextResponse.json(
        { indexed: 0, skipped: 0, total: photos.length, reason: 'migration_019_required' },
        { status: 200 }
      )
    }
    return NextResponse.json({ error: msg || 'index read failed' }, { status: 500 })
  }

  const pending = photos.filter((p) => !already.has(p.id))
  const batch = pending.slice(0, limit)

  let indexed = 0
  const errors: { drive_file_id: string; error: string }[] = []

  for (const photo of batch) {
    try {
      const bytes = await getPhotoBytes(photo.id, { downscaleOverLimit: true })
      if (!bytes) throw new Error('could not download bytes')
      if (!VISION_MIMES.includes(bytes.mimeType as VisionMime)) {
        throw new Error(`${bytes.mimeType} cannot be sent to the vision API — convert to JPEG`)
      }
      const described = await callAgentVisionJSON<Partial<IndexedPhoto>>({
        model: MODEL_HAIKU,
        systemPrompt: SYSTEM_PROMPT,
        cacheSystem: true,
        userText: `File name: ${photo.name || 'unnamed'}\n\nDescribe this photo.`,
        images: [{ data: bytes.data, mediaType: bytes.mimeType as VisionMime }],
        maxTokens: 512,
      })
      const description = described.description?.trim()
      if (!description) throw new Error('vision returned no description')
      const tags = Array.isArray(described.tags)
        ? described.tags
            .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
            .map((t) => t.trim().toLowerCase())
            .slice(0, 10)
        : []

      await upsertPhotoIndex({
        clinic_id: clinicId,
        drive_folder_id: driveFolderId,
        drive_file_id: photo.id,
        file_name: photo.name || null,
        description,
        tags,
        description_model: MODEL_HAIKU,
      })
      indexed += 1
    } catch (e) {
      // One bad photo must not sink the batch — report it and move on.
      errors.push({
        drive_file_id: photo.id,
        error: e instanceof Error ? e.message : 'unknown error',
      })
    }
  }

  return NextResponse.json({
    indexed,
    skipped: already.size,
    total: photos.length,
    remaining: Math.max(0, pending.length - batch.length),
    ...(errors.length ? { errors } : {}),
  })
}
