import type { KeepInterval } from './cuts'
import type { WhisperWord } from './whisper'

// Animated (karaoke) captions as an .ass file. libass renders \k tags
// natively inside ffmpeg's subtitles filter: every word starts in
// SecondaryColour and flips to PrimaryColour exactly when it is spoken —
// the creator-style word-by-word highlight, no per-frame filters needed.
//
// Words arrive on the SOURCE timeline; the cut plan removed chunks, so
// each word is remapped to the post-cut timeline by walking the keep
// list and accumulating output time (same approach as srt.ts).

export interface AssStyleSpec {
  fontname: string
  fontsize: number
  /** Spoken/active word colour — libass &HAABBGGRR. */
  primaryColour: string
  /** Not-yet-spoken text colour. */
  secondaryColour: string
  outlineColour: string
  outline: number
  shadow: number
  marginV: number
  bold: boolean
}

interface OutWord {
  text: string
  start: number // seconds, post-cut timeline
  end: number
}

const MAX_WORDS_PER_LINE = 4
const MAX_CHARS_PER_LINE = 26
const LINE_BREAK_GAP_S = 0.6

function fmtAss(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const cs = Math.floor((seconds - Math.floor(seconds)) * 100)
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

// Map source-timeline words into the post-cut timeline, dropping words
// that fall inside removed chunks.
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
      out.push({
        text,
        start: outCursor + Math.max(0, w.start - k.start),
        end: outCursor + Math.min(dur, Math.max(0.05, w.end - k.start)),
      })
    }
    outCursor += dur
  }
  return out
}

function groupIntoLines(words: OutWord[]): OutWord[][] {
  const lines: OutWord[][] = []
  let line: OutWord[] = []
  let chars = 0
  for (const w of words) {
    const prev = line[line.length - 1]
    const breakByGap = prev !== undefined && w.start - prev.end > LINE_BREAK_GAP_S
    const breakBySize =
      line.length >= MAX_WORDS_PER_LINE || chars + w.text.length + 1 > MAX_CHARS_PER_LINE
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

// ASS text is rendered literally; strip characters that would break
// the Dialogue line or open override blocks.
function esc(text: string): string {
  return text.replace(/[{}\\]/g, '').replace(/\n/g, ' ')
}

export function buildKaraokeAss(
  words: WhisperWord[],
  keep: KeepInterval[],
  style: AssStyleSpec
): string {
  const remapped = remapWords(words, keep)
  const lines = groupIntoLines(remapped)

  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    'PlayResX: 1080',
    'PlayResY: 1920',
    'ScaledBorderAndShadow: yes',
    'WrapStyle: 2',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Cap,${style.fontname},${style.fontsize},${style.primaryColour},${style.secondaryColour},${style.outlineColour},&H80000000,${style.bold ? '-1' : '0'},0,0,0,100,100,0,0,1,${style.outline},${style.shadow},2,60,60,${style.marginV},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ]

  const events: string[] = []
  for (const line of lines) {
    const start = line[0].start
    const end = line[line.length - 1].end + 0.12
    const parts: string[] = ['{\\fad(70,40)}']
    for (let i = 0; i < line.length; i++) {
      const w = line[i]
      // Lead-in silence before the first word keeps the fill in sync.
      if (i === 0 && w.start > start) {
        parts.push(`{\\k${Math.round((w.start - start) * 100)}}`)
      }
      const durCs = Math.max(5, Math.round((w.end - w.start) * 100))
      parts.push(`{\\k${durCs}}${esc(w.text)}`)
      if (i < line.length - 1) parts.push(' ')
    }
    events.push(
      `Dialogue: 0,${fmtAss(start)},${fmtAss(end)},Cap,,0,0,0,,${parts.join('')}`
    )
  }

  return [...header, ...events, ''].join('\n')
}
