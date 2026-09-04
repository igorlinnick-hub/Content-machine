import type { KeepInterval } from './cuts'
import type { WhisperWord } from './whisper'
import {
  buildCaptionLines,
  lineEnd,
  lineStart,
  type CaptionLine,
} from './caption-lines'

// Animated (karaoke) captions as an .ass file. libass renders \k tags
// natively inside ffmpeg's subtitles filter: every word starts in
// SecondaryColour and flips to PrimaryColour exactly when it is spoken —
// the creator-style word-by-word highlight, no per-frame filters needed.
//
// The line grouping and the source→output remap live in caption-lines.ts,
// shared with the .srt writer so the burned captions and the sidecar say the
// same words at the same moments.

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

function fmtAss(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const cs = Math.floor((seconds - Math.floor(seconds)) * 100)
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

// ASS text is rendered literally; strip characters that would break
// the Dialogue line or open override blocks.
function esc(text: string): string {
  return text.replace(/[{}\\]/g, '').replace(/\n/g, ' ')
}

function dialogue(line: CaptionLine, next: CaptionLine | undefined): string {
  const start = lineStart(line)
  const end = lineEnd(line, next)
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
  return `Dialogue: 0,${fmtAss(start)},${fmtAss(end)},Cap,,0,0,0,,${parts.join('')}`
}

export function buildKaraokeAss(
  words: WhisperWord[],
  keep: KeepInterval[],
  style: AssStyleSpec
): string {
  const lines = buildCaptionLines(words, keep)

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

  const events = lines.map((line, i) => dialogue(line, lines[i + 1]))

  return [...header, ...events, ''].join('\n')
}
