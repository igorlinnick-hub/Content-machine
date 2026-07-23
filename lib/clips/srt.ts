import type { KeepInterval } from './cuts'

// Generate an .srt from per-segment caption cues. After cuts the
// source timestamps no longer line up with the cleaned output —
// each cue is REMAPPED onto the post-cut timeline by walking the
// keep list. Cues stay at spoken-phrase granularity even when the
// keep intervals merged several phrases into one uncut block.

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

export function buildSrt(cues: KeepInterval[], keep: KeepInterval[]): string {
  const lines: string[] = []
  let n = 0
  for (const cue of cues) {
    const start = remap(cue.start, keep)
    const end = remap(cue.end, keep)
    if (end - start < 0.05 || !cue.text) continue
    n += 1
    lines.push(String(n))
    lines.push(`${fmt(start)} --> ${fmt(end)}`)
    lines.push(cue.text)
    lines.push('')
  }
  return lines.join('\n')
}
