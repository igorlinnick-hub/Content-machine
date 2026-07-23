import type { WhisperSegment } from './whisper'

// Plan the cuts list from Whisper segments — SOFT cutting per the
// BINDING editing rules (HANDOFF §22.2 «Правила монтажа», adopted
// from the proven local video bot on 2026-07-23):
//
//   - pad ±PAD_SEC around every speech region (the bot's
//     auto-editor margin: 0.1s clipped syllables, 0.2s does not)
//   - silences shorter than MERGE_GAP_SEC are NOT cut at all —
//     natural pauses stay, that's what keeps the edit smooth
//   - longer silences are cut, but the pads leave ~0.4s of
//     breathing room across the joint (no hard jump)
//   - fragments shorter than MIN_FRAGMENT_SEC are dropped
//   - filler-only segments (um/uh/er…) are dropped entirely
//
// Output: `keep` = merged intervals for the ffmpeg concat;
// `cues` = per-segment caption cues (source timeline) that
// lib/clips/srt.ts remaps onto the post-cut timeline.

const STRICT_FILLER_REGEX = /^[\s,.\-—]*\b(?:u+m+|u+h+|a+h+|e+r+|h+m+m+|m+h+m+)+[\s,.\-—!?]*$/i

const PAD_SEC = 0.2
const MERGE_GAP_SEC = 0.5
const MIN_FRAGMENT_SEC = 0.4

export interface KeepInterval {
  // Source-video timestamps.
  start: number
  end: number
  text: string
}

export interface CutsPlan {
  keep: KeepInterval[]
  // Caption cues: one per spoken segment, source timeline. Each cue
  // lies inside some keep interval (padding only widens).
  cues: KeepInterval[]
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
  let fillerCount = 0

  const usable = segments.filter((s) => {
    if (isPureFiller(s.text)) {
      fillerCount += 1
      return false
    }
    return true
  })

  // Pad each speech region, then merge neighbours whose (padded)
  // gap is below the threshold — those pauses are kept verbatim.
  const merged: KeepInterval[] = []
  for (const s of usable) {
    const start = Math.max(0, s.start - PAD_SEC)
    const end = Math.min(totalDuration, s.end + PAD_SEC)
    const prev = merged[merged.length - 1]
    if (prev && start - prev.end < MERGE_GAP_SEC) {
      prev.end = Math.max(prev.end, end)
      prev.text = `${prev.text} ${s.text.trim()}`.trim()
    } else {
      merged.push({ start, end, text: s.text.trim() })
    }
  }

  const keep = merged.filter(
    (k) => merged.length === 1 || k.end - k.start >= MIN_FRAGMENT_SEC
  )

  const cues: KeepInterval[] = usable.map((s) => ({
    start: s.start,
    end: s.end,
    text: s.text.trim(),
  }))

  const durationOut = keep.reduce((acc, k) => acc + (k.end - k.start), 0)

  return {
    keep,
    cues,
    duration_in_sec: totalDuration,
    duration_out_sec: durationOut,
    filler_count: fillerCount,
    silence_count: Math.max(0, keep.length - 1),
  }
}
