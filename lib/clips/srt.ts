import type { KeepInterval } from './cuts'
import type { WhisperWord } from './whisper'
import {
  buildCaptionLines,
  lineEnd,
  lineStart,
  lineText,
  type CaptionLine,
} from './caption-lines'

// The .srt that ships next to the video. Built from the SAME caption lines the
// burn uses (caption-lines.ts), so the sidecar and the picture agree word for
// word — before, the burn came from word timings and the sidecar from Whisper's
// segment text, and the two drifted apart on every clip.
//
// The segment path below survives only as a fallback for a transcriber that
// returned no word timings at all; there the cues are remapped onto the
// post-cut timeline by walking the keep list.

function fmt(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds - Math.floor(seconds)) * 1000)
  return (
    String(h).padStart(2, '0') +
    ':' +
    String(m).padStart(2, '0') +
    ':' +
    String(s).padStart(2, '0') +
    ',' +
    String(ms).padStart(3, '0')
  )
}

function block(n: number, start: number, end: number, text: string): string[] {
  return [String(n), `${fmt(start)} --> ${fmt(end)}`, text, '']
}

function fromLines(lines: CaptionLine[]): string {
  const out: string[] = []
  let n = 0
  lines.forEach((line, i) => {
    const start = lineStart(line)
    const end = lineEnd(line, lines[i + 1])
    const text = lineText(line)
    if (end - start < 0.05 || !text) return
    n += 1
    out.push(...block(n, start, end, text))
  })
  return out.join('\n')
}

// Map a source-timeline moment onto the output timeline. Moments
// inside a cut gap snap to the start of the next kept region.
function remap(t: number, keep: KeepInterval[]): number {
  let out = 0
  for (const k of keep) {
    if (t < k.start) return out
    if (t <= k.end) return out + (t - k.start)
    out += k.end - k.start
  }
  return out
}

function fromCues(cues: KeepInterval[], keep: KeepInterval[]): string {
  const out: string[] = []
  let n = 0
  for (const cue of cues) {
    const start = remap(cue.start, keep)
    const end = remap(cue.end, keep)
    if (end - start < 0.05 || !cue.text) continue
    n += 1
    out.push(...block(n, start, end, cue.text))
  }
  return out.join('\n')
}

export function buildSrt(params: {
  /** Surviving words, source timeline. Preferred — matches the burn exactly. */
  words: WhisperWord[]
  /** Segment cues, source timeline. Used only when there are no words. */
  cues: KeepInterval[]
  keep: KeepInterval[]
}): string {
  if (params.words.length > 0) {
    return fromLines(buildCaptionLines(params.words, params.keep))
  }
  return fromCues(params.cues, params.keep)
}
