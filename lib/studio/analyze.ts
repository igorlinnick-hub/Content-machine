import {
  callAgentJSON,
  callAgentVisionJSON,
  MODEL_HAIKU,
} from '@/lib/agents/base'

export interface VideoFormatAnalysis {
  style_description: string
  beats: { name: string; text: string }[]
}

const SYS = `You analyse a viral short-form medical/health video so a clinic can RE-FILM the same FORMAT (not copy the content). You are given the video's COVER FRAME (if available) and its CAPTION.

Extract the repeatable FORMAT, not the specific medical claims. Return ONLY JSON:
{
  "style_description": "one line naming the repeatable format + why it works, e.g. 'Fact-check myth-bust: states a common belief, then debunks it with one clear fact and a confident tone'",
  "beats": [
    { "name": "hook", "text": "what happens in the first 2s" },
    { "name": "...", "text": "..." }
  ]
}

Rules: 3-5 beats. Describe the STRUCTURE/flow a clinic could re-shoot with their own topic. Keep each beat short. Do NOT invent medical claims.`

const FALLBACK: VideoFormatAnalysis = {
  style_description:
    'Vertical talking-head reel — sharp hook, plain-English point, one clear takeaway.',
  beats: [
    { name: 'hook', text: 'Open with a question or myth in the first 2s.' },
    { name: 'point', text: 'Explain / bust it in plain English.' },
    { name: 'cta', text: 'One clear takeaway.' },
  ],
}

// Analyse a video's FORMAT from its cover image (+ caption). Falls back to a
// caption-only pass when there's no cover, and to a sane default on error so
// ingestion never breaks.
export async function analyzeVideoFormat(params: {
  caption: string
  cover?: { data: Buffer; mediaType: 'image/jpeg' | 'image/png' } | null
}): Promise<VideoFormatAnalysis> {
  const userText = `CAPTION:\n${(params.caption || '(none)').slice(0, 600)}\n\nAnalyse the format.`
  try {
    let out: VideoFormatAnalysis
    if (params.cover) {
      out = await callAgentVisionJSON<VideoFormatAnalysis>({
        model: MODEL_HAIKU,
        systemPrompt: SYS,
        userText,
        images: [{ data: params.cover.data, mediaType: params.cover.mediaType }],
        maxTokens: 600,
      })
    } else {
      out = await callAgentJSON<VideoFormatAnalysis>({
        model: MODEL_HAIKU,
        systemPrompt: SYS,
        userContent: userText,
        maxTokens: 600,
        effort: 'low',
      })
    }
    const beats = Array.isArray(out?.beats) ? out.beats.filter((b) => b?.name && b?.text) : []
    if (!out?.style_description || beats.length === 0) return FALLBACK
    return { style_description: out.style_description, beats }
  } catch {
    return FALLBACK
  }
}
