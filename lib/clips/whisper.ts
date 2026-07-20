// Transcription for the /clips pipeline. Primary: WhisperX on
// Replicate (~$0.01/min) — the same chain the local video editing
// bot uses (My Bots bot/scripts/transcribe_replicate.py), and
// REPLICATE_API_TOKEN is already on prod. Fallback: OpenAI Whisper
// when only OPENAI_API_KEY is set.
//
// We feed extracted audio (low-bitrate mono mp3 — Whisper doesn't
// need fidelity). Segments drive the cut planner + SRT; word-level
// timestamps power the transcript editor (edit-by-word, ms cuts).

export interface WhisperSegment {
  id: number
  start: number
  end: number
  text: string
}

export interface WhisperWord {
  word: string
  start: number
  end: number
}

export interface WhisperResult {
  text: string
  language: string
  segments: WhisperSegment[]
  words: WhisperWord[]
  duration: number
}

const REPLICATE_BASE = 'https://api.replicate.com/v1'
const WHISPERX_MODEL = 'victor-upmeet/whisperx-a40-large'

interface WhisperXSegment {
  start?: number
  end?: number
  text?: string
  words?: Array<{ word?: string; start?: number; end?: number }>
}

async function replicateReq(
  token: string,
  path: string,
  body?: unknown
): Promise<Record<string, unknown>> {
  const res = await fetch(`${REPLICATE_BASE}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`replicate ${res.status}: ${text.slice(0, 300)}`)
  }
  return (await res.json()) as Record<string, unknown>
}

async function transcribeViaReplicate(params: {
  audio: Buffer
  language?: string
  token: string
}): Promise<WhisperResult> {
  const { token } = params
  const audioUri = `data:audio/mpeg;base64,${params.audio.toString('base64')}`

  // Latest model version (same approach as the bot's proven script).
  const versions = await replicateReq(token, `/models/${WHISPERX_MODEL}/versions`)
  const version = (versions.results as Array<{ id: string }> | undefined)?.[0]?.id
  if (!version) throw new Error('whisperx: no model version found')

  // align_output gives word-level timestamps (the bot skips them; we
  // need words for the transcript editor).
  const input: Record<string, unknown> = {
    audio_file: audioUri,
    align_output: true,
  }
  if (params.language) input.language = params.language

  const pred = await replicateReq(token, '/predictions', { version, input })
  const pid = pred.id as string
  if (!pid) throw new Error('whisperx: prediction not created')

  // Poll until terminal. Budget stays inside the route's 300s cap —
  // WhisperX on an A40 transcribes far faster than realtime.
  const startedAt = Date.now()
  for (;;) {
    if (Date.now() - startedAt > 240_000) {
      throw new Error('whisperx: polling timed out after 240s')
    }
    const s = await replicateReq(token, `/predictions/${pid}`)
    const status = s.status as string
    if (status === 'succeeded') {
      const out = s.output as
        | { segments?: WhisperXSegment[]; detected_language?: string; word_segments?: Array<{ word?: string; start?: number; end?: number }> }
        | WhisperXSegment[]
        | null
      const rawSegments: WhisperXSegment[] = Array.isArray(out)
        ? out
        : out?.segments ?? []
      const segments: WhisperSegment[] = rawSegments.map((seg, i) => ({
        id: i,
        start: Number(seg.start ?? 0),
        end: Number(seg.end ?? 0),
        text: (seg.text ?? '').trim(),
      }))
      const words: WhisperWord[] = []
      const rawWords = !Array.isArray(out) && out?.word_segments?.length
        ? out.word_segments
        : rawSegments.flatMap((seg) => seg.words ?? [])
      for (const w of rawWords) {
        if (w.word == null || w.start == null || w.end == null) continue
        words.push({ word: String(w.word), start: Number(w.start), end: Number(w.end) })
      }
      const language =
        (!Array.isArray(out) ? (out?.detected_language as string | undefined) : undefined) ??
        params.language ??
        'en'
      return {
        text: segments.map((seg) => seg.text).join(' ').trim(),
        language,
        segments,
        words,
        duration: segments.length ? segments[segments.length - 1].end : 0,
      }
    }
    if (status === 'failed' || status === 'canceled') {
      throw new Error(`whisperx: prediction ${status} — ${String(s.error ?? '').slice(0, 300)}`)
    }
    await new Promise((r) => setTimeout(r, 2_000))
  }
}

async function transcribeViaOpenAI(params: {
  audio: Buffer
  fileName: string
  language?: string
  apiKey: string
}): Promise<WhisperResult> {
  const fd = new FormData()
  const blob = new Blob([params.audio as unknown as ArrayBuffer], {
    type: 'audio/mpeg',
  })
  fd.append('file', blob, params.fileName)
  fd.append('model', 'whisper-1')
  fd.append('response_format', 'verbose_json')
  fd.append('timestamp_granularities[]', 'segment')
  fd.append('timestamp_granularities[]', 'word')
  if (params.language) fd.append('language', params.language)

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { authorization: `Bearer ${params.apiKey}` },
    body: fd,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`whisper ${res.status}: ${body.slice(0, 300)}`)
  }
  const data = (await res.json()) as {
    text?: string
    language?: string
    duration?: number
    segments?: Array<{ id: number; start: number; end: number; text: string }>
    words?: Array<{ word: string; start: number; end: number }>
  }
  return {
    text: data.text ?? '',
    language: data.language ?? 'en',
    duration: data.duration ?? 0,
    segments: (data.segments ?? []).map((s) => ({
      id: s.id,
      start: s.start,
      end: s.end,
      text: s.text.trim(),
    })),
    words: (data.words ?? []).map((w) => ({
      word: w.word,
      start: w.start,
      end: w.end,
    })),
  }
}

export async function transcribeAudio(params: {
  audio: Buffer
  fileName: string
  language?: string // ISO 639-1 hint; omit to auto-detect
}): Promise<WhisperResult> {
  const replicateToken = process.env.REPLICATE_API_TOKEN
  if (replicateToken) {
    return transcribeViaReplicate({
      audio: params.audio,
      language: params.language,
      token: replicateToken,
    })
  }
  const openaiKey = process.env.OPENAI_API_KEY
  if (openaiKey) {
    return transcribeViaOpenAI({ ...params, apiKey: openaiKey })
  }
  throw new Error(
    'transcription not configured: set REPLICATE_API_TOKEN (WhisperX) or OPENAI_API_KEY'
  )
}
