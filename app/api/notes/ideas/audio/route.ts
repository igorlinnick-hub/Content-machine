import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { createIdeaNote, uploadNotePhoto } from '@/lib/notes/ideas'
import { noteTidyEnabled, tidyNote } from '@/lib/agents/note-tidy'
import { transcribeAudio } from '@/lib/clips/whisper'
import type { TidyStatus } from '@/lib/notes/ideas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Whisper polls up to 240 s on Replicate before the tidy pass runs —
// same budget as the clips routes that share the transcriber.
export const maxDuration = 300

// ~10 minutes of talking at Opus/AAC voice bitrates. Base64 for the
// Replicate data URI grows it 4/3×, still far under request limits.
const MAX_BYTES = 20 * 1024 * 1024

// What MediaRecorder actually produces: webm/opus (Chrome, Android),
// mp4/AAC (Safari, iPhone — the device this is built for), plus the
// formats a file picker could reasonably hand us. Keys may arrive with
// codec suffixes ("audio/webm;codecs=opus"), so match on the base type.
const ALLOWED_TYPES = new Map<string, string>([
  ['audio/webm', 'webm'],
  ['audio/mp4', 'm4a'],
  ['audio/mpeg', 'mp3'],
  ['audio/wav', 'wav'],
  ['audio/ogg', 'ogg'],
])

export async function POST(req: Request) {
  const access = await resolveAccess()
  if (!access) return NextResponse.json({ error: 'authentication required' }, { status: 401 })

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

  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'audio file required' }, { status: 400 })
  }
  if (file.size === 0) return NextResponse.json({ error: 'empty recording' }, { status: 400 })
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'recording too large (max 20 MB)' }, { status: 413 })
  }
  const baseType = file.type.split(';')[0].trim().toLowerCase()
  const ext = ALLOWED_TYPES.get(baseType)
  if (!ext) {
    return NextResponse.json(
      { error: `unsupported audio type ${file.type || 'unknown'}` },
      { status: 415 }
    )
  }

  try {
    // 1. Store the recording first — the voice is the ground truth,
    // same contract as the photographed page.
    const bytes = new Uint8Array(await file.arrayBuffer())
    const stored = await uploadNotePhoto(clinicId, {
      bytes,
      contentType: baseType,
      ext,
    })

    // 2. Whisper → verbatim text (becomes raw_body). Runs on
    // REPLICATE_API_TOKEN, not the Anthropic kill-switch, so a voice
    // note still lands as raw text even with LLM agents off.
    const transcription = await transcribeAudio({
      audio: Buffer.from(bytes),
      fileName: `note.${ext}`,
      mimeType: baseType,
    })
    const rawText = transcription.text.trim()
    if (!rawText) {
      return NextResponse.json(
        { error: 'could not hear any words in the recording — try again closer to the mic' },
        { status: 422 }
      )
    }

    // 3. Tidy pass. Best-effort, same as typed and photo notes.
    let tidied: Awaited<ReturnType<typeof tidyNote>> | null = null
    let tidyStatus: TidyStatus = 'raw'
    if (noteTidyEnabled()) {
      try {
        tidied = await tidyNote(rawText)
        tidyStatus = 'tidied'
      } catch {
        tidyStatus = 'failed'
      }
    }

    const note = await createIdeaNote(clinicId, {
      rawBody: rawText,
      body: tidied?.body,
      title: tidied?.title ?? null,
      source: 'voice',
      tidyStatus,
      tidyFlags: tidied?.flags ?? [],
      tidyIssues: tidied?.issues ?? [],
      audioUrl: stored.url,
      storagePaths: [stored.path],
    })
    return NextResponse.json({ note })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
