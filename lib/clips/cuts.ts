import type { WhisperSegment } from './whisper'

// Plan the cuts list from Whisper segments. Two kinds of cuts:
//   1. Filler-only segments: text matches strict filler regex (um/uh/
//      ah/er/hmm and pure variants). Drop the whole segment.
//   2. Inter-segment silences > MIN_SILENCE_SEC. We keep the segment,
//      but compress the gap before it to a tight FILLER_GAP_SEC.
//
// Output is a list of "keep" intervals on the source timeline. The
// ffmpeg pipeline then concats these intervals.

const STRICT_FILLER_REGEX = /^[\s,.\-—]*\b(?:u+m+|u+h+|a+h+|e+r+|h+m+m+|m+h+m+)+[\s,.\-—!?]*$/i

const MIN_SILENCE_SEC = 0.6
// Replace gaps > MIN_SILENCE_SEC with a small natural pause so cuts
// don't sound like jump-cuts. Set to 0 for hard cuts.
const COMPRESSED_GAP_SEC = 0.15

export interface KeepInterval {
  // Source-video timestamps (post-Whisper, exact to Whisper's grid).
  start: number
  end: number
  text: string
}

export interface CutsPlan {
  keep: KeepInterval[]
  duration_in_sec: number
  duration_out_sec: number
  filler_count: number
  silence_count: number
}

function isPureFiller(text: string): boolean {
  return STRICT_FILLER_REGEX.test(text.trim())
}

export function planCuts(
  segments: WhisperSegment[],
  totalDuration: number
): CutsPlan {
  const keep: KeepInterval[] = []
  let fillerCount = 0
  let silenceCount = 0

  // First pass: drop pure-filler segments.
  const usable = segments.filter((s) => {
    if (isPureFiller(s.text)) {
      fillerCount += 1
      return false
    }
    return true
  })

  // Second pass: collapse big gaps. Build keep intervals — for each
  // usable segment, push (segment.start, segment.end). When a gap
  // before the next segment exceeds MIN_SILENCE_SEC, we keep the
  // segment as-is but the ffmpeg concat will tightly butt them
  // together (gap collapses to 0); the COMPRESSED_GAP_SEC is
  // achieved by extending each segment's end by half-gap.
  for (let i = 0; i < usable.length; i++) {
    const cur = usable[i]
    const next = usable[i + 1]

    let extendedEnd = cur.end
    if (next) {
      const gap = next.start - cur.end
      if (gap > MIN_SILENCE_SEC) {
        silenceCount += 1
        // Keep half of COMPRESSED_GAP_SEC at the end of this segment
        // so audio doesn't end on a hard click. The other half is
        // implicit at the start of the next (its own pre-roll).
        extendedEnd = cur.end + COMPRESSED_GAP_SEC / 2
      }
    }

    keep.push({
      start: Math.max(0, cur.start),
      end: Math.min(totalDuration, extendedEnd),
      text: cur.text,
    })
  }

  const duration_out_sec = keep.reduce((sum, k) => sum + (k.end - k.start), 0)

  return {
    keep,
    duration_in_sec: totalDuration,
    duration_out_sec,
    filler_count: fillerCount,
    silence_count: silenceCount,
  }
}
