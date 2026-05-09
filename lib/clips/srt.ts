import type { KeepInterval } from './cuts'

// Generate an .srt file from a list of kept intervals. After cuts
// the source-video timestamps no longer line up with the cleaned
// output — captions need to be REMAPPED to the post-cut timeline.
// We do that by walking the keep list and accumulating each
// segment's duration as the running output time.

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

export function buildSrt(intervals: KeepInterval[]): string {
  const lines: string[] = []
  let outCursor = 0
  for (let i = 0; i < intervals.length; i++) {
    const k = intervals[i]
    const dur = k.end - k.start
    const outStart = outCursor
    const outEnd = outStart + dur
    lines.push(String(i + 1))
    lines.push(`${fmt(outStart)} --> ${fmt(outEnd)}`)
    lines.push(k.text)
    lines.push('')
    outCursor = outEnd
  }
  return lines.join('\n')
}
