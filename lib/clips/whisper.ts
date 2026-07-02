// OpenAI Whisper transcription for the /clips pipeline. We feed it
// extracted audio (low-bitrate mono mp3 — Whisper doesn't need
// fidelity) and ask for verbose_json with segment timestamps. The
// segments drive both the cut planner and the SRT generator, so
// timing must match the source video exactly (audio-only doesn't
// drift relative to its source).

export interface WhisperSegment {
  id: number
  start: number
  end: number
  text: string
}

// Word-level timestamps power the transcript editor (edit-by-word,
// millisecond cuts). The cut planner still works on segments; words
// are captured alongside so clips processed today can be re-edited
// later without re-transcribing.
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

export async function transcribeAudio(params: {
  audio: Buffer
  fileName: string
  language?: string // ISO 639-1 hint; omit to let Whisper detect
}): Promise<WhisperResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not set')

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
    headers: { authorization: `Bearer ${apiKey}` },
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
