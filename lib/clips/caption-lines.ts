import type { KeepInterval } from './cuts'
import type { WhisperWord } from './whisper'

// One caption timeline, two consumers (Igor 2026-09-03).
//
// The burned captions and the .srt sidecar used to be built from different
// data — the burn from word timings, the sidecar from Whisper's segment text —
// so the file next to the video did not say quite what the video said. They
// are now grouped here once, and both renderers read the same lines: same
// words, same breaks, same timings, every run.
//
// Words arrive on the SOURCE timeline; the cut plan removed chunks, so each
// word is remapped onto the post-cut timeline by walking the keep list and
// accumulating output time.

export interface OutWord {
  text: string
  /** Seconds on the post-cut timeline. */
  start: number
  end: number
}

export type CaptionLine = OutWord[]

const MAX_WORDS_PER_LINE = 4
const MAX_CHARS_PER_LINE = 26
const LINE_BREAK_GAP_S = 0.6
/** Shortest caption a word may hold on screen. */
const MIN_WORD_SEC = 0.05
/** How long a finished line lingers before the next one takes over. */
const LINE_HOLD_SEC = 0.12
/** Gap left between two consecutive lines so libass never stacks them. */
const LINE_SEPARATION_SEC = 0.02

function remapWords(words: WhisperWord[], keep: KeepInterval[]): OutWord[] {
  const out: OutWord[] = []
  let outCursor = 0
  for (const k of keep) {
    const dur = k.end - k.start
    for (const w of words) {
      const mid = (w.start + w.end) / 2
      if (mid < k.start || mid >= k.end) continue
      const text = w.word.trim()
      if (!text) continue
      const relStart = Math.min(Math.max(0, w.start - k.start), dur)
      const relEnd = Math.min(
        Math.max(w.end - k.start, relStart + MIN_WORD_SEC),
        dur
      )
      out.push({
        text,
        start: outCursor + relStart,
        end: outCursor + Math.max(relEnd, relStart + MIN_WORD_SEC),
      })
    }
    outCursor += dur
  }
  return out.sort((a, b) => a.start - b.start)
}

function groupIntoLines(words: OutWord[]): CaptionLine[] {
  const lines: CaptionLine[] = []
  let line: OutWord[] = []
  let chars = 0
  for (const w of words) {
    const prev = line[line.length - 1]
    const breakByGap = prev !== undefined && w.start - prev.end > LINE_BREAK_GAP_S
    const breakBySize =
      line.length >= MAX_WORDS_PER_LINE ||
      chars + w.text.length + 1 > MAX_CHARS_PER_LINE
    if (line.length > 0 && (breakByGap || breakBySize)) {
      lines.push(line)
      line = []
      chars = 0
    }
    line.push(w)
    chars += w.text.length + 1
  }
  if (line.length > 0) lines.push(line)
  return lines
}

/** Words → caption lines on the post-cut timeline. */
export function buildCaptionLines(
  words: WhisperWord[],
  keep: KeepInterval[]
): CaptionLine[] {
  return groupIntoLines(remapWords(words, keep))
}

export function lineStart(line: CaptionLine): number {
  return line[0].start
}

/**
 * When a line leaves the screen. It holds briefly after its last word, but
 * never into the next line — two overlapping Dialogue events render stacked,
 * which is the "captions doubled up" defect.
 */
export function lineEnd(line: CaptionLine, next?: CaptionLine): number {
  const natural = line[line.length - 1].end + LINE_HOLD_SEC
  if (!next) return natural
  const ceiling = next[0].start - LINE_SEPARATION_SEC
  return Math.max(line[line.length - 1].end, Math.min(natural, ceiling))
}

export function lineText(line: CaptionLine): string {
  return line.map((w) => w.text).join(' ')
}
