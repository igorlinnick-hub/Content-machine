import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { createIdeaNote, uploadNotePhoto } from '@/lib/notes/ideas'
import {
  noteTidyEnabled,
  tidyNote,
  transcribeNotePhotos,
} from '@/lib/agents/note-tidy'
import type { VisionImageInput } from '@/lib/agents/base'
import type { TidyStatus } from '@/lib/notes/ideas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Two model calls (vision transcription + tidy) on top of the upload.
export const maxDuration = 120

// Vision API rejects >~7 MB of base64 per image (see lib/google/drive.ts),
// and phone photos of a page compress well under that as JPEG.
const MAX_BYTES = 8 * 1024 * 1024
const MAX_FILES = 4

const ALLOWED_TYPES = new Map<string, { ext: string; media: VisionImageInput['mediaType'] }>([
  ['image/jpeg', { ext: 'jpg', media: 'image/jpeg' }],
  ['image/png', { ext: 'png', media: 'image/png' }],
  ['image/webp', { ext: 'webp', media: 'image/webp' }],
])

export async function POST(req: Request) {
  const access = await resolveAccess()
  if (!access) return NextResponse.json({ error: 'authentication required' }, { status: 401 })

  if (!noteTidyEnabled()) {
    // Without the vision pass there is nothing to transcribe — better an
    // honest error than a note holding an unviewable photo.
    return NextResponse.json(
      { error: 'photo transcription requires LLM agents to be enabled' },
      { status: 409 }
    )
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'expected multipart/form-data' }, { status: 400 })
  }

  const clinicId = String(form.get('clinicId') ?? '').trim()
  if (!clinicId) return NextResponse.json({ error: 'clinicId required' }, { status: 400 })
  if (access.role !== 'admin' && access.clinicId !== clinicId) {
    return NextResponse.json({ error: 'access denied' }, { status: 403 })
  }

  const files = form.getAll('files').filter((f): f is File => f instanceof File)
  if (files.length === 0) {
    return NextResponse.json({ error: 'at least one photo required' }, { status: 400 })
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `max ${MAX_FILES} photos per note` }, { status: 400 })
  }
  for (const f of files) {
    if (f.size === 0) return NextResponse.json({ error: 'empty file' }, { status: 400 })
    if (f.size > MAX_BYTES) {
      return NextResponse.json({ error: 'photo too large (max 8 MB)' }, { status: 413 })
    }
    if (!ALLOWED_TYPES.has(f.type)) {
      return NextResponse.json(
        { error: `unsupported type ${f.type || 'unknown'} — use JPEG/PNG/WebP` },
        { status: 415 }
      )
    }
  }

  try {
    // 1. Store the pages first — the photo of the paper is the ground
    // truth and must survive even if transcription fails midway.
    const images: VisionImageInput[] = []
    const urls: string[] = []
    const paths: string[] = []
    for (const f of files) {
      const kind = ALLOWED_TYPES.get(f.type)!
      const bytes = new Uint8Array(await f.arrayBuffer())
      const stored = await uploadNotePhoto(clinicId, {
        bytes,
        contentType: f.type,
        ext: kind.ext,
      })
      urls.push(stored.url)
      paths.push(stored.path)
      images.push({ data: bytes, mediaType: kind.media })
    }

    // 2. Verbatim transcription → becomes raw_body.
    const transcription = await transcribeNotePhotos(images)
    const rawText = transcription.text.trim()
    if (!rawText) {
      return NextResponse.json(
        { error: 'could not read any text off the photo — try a sharper shot' },
        { status: 422 }
      )
    }

    // 3. Tidy pass over the transcription. Best-effort, like typed notes.
    let tidied: { title: string; body: string; flags: string[] } | null = null
    let tidyStatus: TidyStatus = 'raw'
    try {
      tidied = await tidyNote(rawText)
      tidyStatus = 'tidied'
    } catch {
      tidyStatus = 'failed'
    }

    const note = await createIdeaNote(clinicId, {
      rawBody: rawText,
      body: tidied?.body,
      title: tidied?.title ?? null,
      source: 'photo',
      tidyStatus,
      // Transcription flags (unreadable words) matter even more than
      // tidy flags — surface both.
      tidyFlags: [...transcription.flags, ...(tidied?.flags ?? [])],
      imageUrls: urls,
      storagePaths: paths,
    })
    return NextResponse.json({ note })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
