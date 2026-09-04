import type { WhisperSegment, WhisperWord } from './whisper'

// Plan the cuts list — SAFE cutting (Igor 2026-09-03).
//
// The rule this file exists to enforce: **a cut boundary may only sit in
// silence.** Everything else is negotiable; clipping a word is not. A doctor
// re-records a take that lost half of "regenerative", and the machine has no
// way to know it did that, so the planner refuses any cut it cannot make
// cleanly rather than making it badly.
//
// How that is enforced:
//   - Boundaries are anchored on WORD timestamps, not segment timestamps.
//     Whisper's segment edges are approximate (they routinely land a
//     hundred milliseconds inside the first or last phoneme); its word edges
//     are what the aligner actually measured. Segments are only a fallback
//     for a transcriber that returned no words.
//   - Every boundary keeps EDGE_PAD_SEC of real silence between it and the
//     nearest surviving word, so no joint ever sounds clipped.
//   - A pause is only cut when it is longer than MIN_CUT_GAP_SEC. Short
//     breaths stay: they are what makes the edit sound like speech.
//   - A dropped range (retake or filler) is only removed when there is real
//     silence on BOTH sides of it. No silence to cut in means the cut is
//     REFUSED and counted — the flub survives, which is recoverable, while a
//     severed word is not.
//
// Output: `keep` = merged intervals for the ffmpeg concat; `words` = the
// surviving words on the source timeline, which is what the captions are
// built from, so the burn matches the audio word for word.

const STRICT_FILLER_REGEX = /^[\s,.\-—]*\b(?:u+m+|u+h+|a+h+|e+r+|h+m+m+|m+h+m+)+[\s,.\-—!?]*$/i

/** Silence left standing on each side of every cut, and at head and tail. */
const EDGE_PAD_SEC = 0.3
/** A pause shorter than this is never cut — it is breathing, not dead air. */
const MIN_CUT_GAP_SEC = 1.0
/** A drop needs at least this much silence on both sides to be safe to make. */
const MIN_SILENCE_FOR_DROP_SEC = 0.2
/** Never let a boundary come closer than this to a surviving word. */
const WORD_GUARD_SEC = 0.05
/** Keep fragments shorter than this out of the concat. */
const MIN_FRAGMENT_SEC = 0.4

export interface KeepInterval {
  // Source-video timestamps.
  start: number
  end: number
  text: string
}

export interface CutsPlan {
  keep: KeepInterval[]
  /** Segment-level cues, source timeline. Only used when there are no words. */
  cues: KeepInterval[]
  /** Surviving words, source timeline — the captions are built from these. */
  words: WhisperWord[]
  duration_in_sec: number
  duration_out_sec: number
  filler_count: number
  silence_count: number
  /** Cuts the planner declined to make because it could not make them cleanly. */
  refused_count: number
}

function isPureFiller(text: string): boolean {
  return STRICT_FILLER_REGEX.test(text.trim())
}

interface Range {
  start: number
  end: number
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/** Words the aligner actually timed, in order, with the junk removed. */
function usableWords(words: WhisperWord[]): WhisperWord[] {
  return words
    .filter(
      (w) =>
        typeof w.start === 'number' &&
        typeof w.end === 'number' &&
        w.end > w.start &&
        w.word.trim().length > 0
    )
    .sort((a, b) => a.start - b.start)
}

function overlapsAny(w: WhisperWord, ranges: Range[]): boolean {
  const mid = (w.start + w.end) / 2
  return ranges.some((r) => mid >= r.start && mid < r.end)
}

/**
 * Turn the ranges we would LIKE to remove into the ones we can remove safely.
 * A run of dropped words survives only if there is real silence on both sides
 * of it — otherwise the cut would land inside neighbouring speech, and we keep
 * the flub instead. Returns the accepted runs plus how many were refused.
 */
function acceptableDrops(
  words: WhisperWord[],
  dropped: boolean[]
): { runs: Array<{ from: number; to: number }>; refused: number } {
  const runs: Array<{ from: number; to: number }> = []
  let refused = 0
  let i = 0
  while (i < words.length) {
    if (!dropped[i]) {
      i += 1
      continue
    }
    const from = i
    while (i < words.length && dropped[i]) i += 1
    const to = i - 1

    // Silence available on each side. At the very head or tail of the
    // recording there is no neighbouring word, so there is nothing to clip.
    const before = from === 0 ? Infinity : words[from].start - words[from - 1].end
    const after =
      to === words.length - 1 ? Infinity : words[to + 1].start - words[to].end

    if (before >= MIN_SILENCE_FOR_DROP_SEC && after >= MIN_SILENCE_FOR_DROP_SEC) {
      runs.push({ from, to })
    } else {
      refused += 1
      for (let k = from; k <= to; k++) dropped[k] = false
    }
  }
  return { runs, refused }
}

/** Build keep intervals from the words that survived, cutting only in silence. */
function planFromWords(
  words: WhisperWord[],
  dropRanges: Range[],
  totalDuration: number
): { keep: KeepInterval[]; kept: WhisperWord[]; refused: number } {
  const dropped = words.map((w) => overlapsAny(w, dropRanges))
  const { runs, refused } = acceptableDrops(words, dropped)

  const kept: WhisperWord[] = []
  const keptIndex: number[] = []
  words.forEach((w, i) => {
    if (!dropped[i]) {
      kept.push(w)
      keptIndex.push(i)
    }
  })
  if (kept.length === 0) {
    return { keep: [], kept: [], refused }
  }

  // A gap between two surviving words must be cut when it swallowed a
  // dropped run — that removal is the whole point — and may be cut when it
  // is simply a long pause. The pad never crosses a dropped word, so a
  // padded joint cannot resurrect half of the flub it just removed.
  const removedBetween = new Map<number, { start: number; end: number }>()
  for (const run of runs) {
    const prevKept = keptIndex.filter((idx) => idx < run.from).pop()
    if (prevKept === undefined) continue
    const posInKept = keptIndex.indexOf(prevKept)
    if (posInKept < 0 || posInKept >= kept.length - 1) continue
    removedBetween.set(posInKept, {
      start: words[run.from].start,
      end: words[run.to].end,
    })
  }

  const keep: KeepInterval[] = []
  let regionStart = clamp(kept[0].start - EDGE_PAD_SEC, 0, totalDuration)
  let text: string[] = []

  for (let i = 0; i < kept.length; i++) {
    text.push(kept[i].word.trim())
    const next = kept[i + 1]
    if (!next) break

    const gap = next.start - kept[i].end
    const removed = removedBetween.get(i)
    if (!removed && gap < MIN_CUT_GAP_SEC) continue

    // Close the region after this word, reopen before the next one. Both
    // boundaries stay WORD_GUARD_SEC clear of the words they neighbour, and
    // never reach into whatever was removed in between.
    let left = kept[i].end + EDGE_PAD_SEC
    let right = next.start - EDGE_PAD_SEC
    if (removed) {
      left = Math.min(left, removed.start - WORD_GUARD_SEC)
      right = Math.max(right, removed.end + WORD_GUARD_SEC)
    }
    left = clamp(Math.max(left, kept[i].end + WORD_GUARD_SEC), 0, totalDuration)
    right = clamp(
      Math.min(right, next.start - WORD_GUARD_SEC),
      0,
      totalDuration
    )
    if (right <= left) continue // nowhere safe to cut — leave it uncut

    keep.push({ start: regionStart, end: left, text: text.join(' ') })
    regionStart = right
    text = []
  }

  keep.push({
    start: regionStart,
    end: clamp(kept[kept.length - 1].end + EDGE_PAD_SEC, 0, totalDuration),
    text: text.join(' '),
  })

  return {
    keep: keep.filter((k, _, all) => all.length === 1 || k.end - k.start >= MIN_FRAGMENT_SEC),
    kept,
    refused,
  }
}

/** Fallback for a transcriber that gave us no word timings. */
function planFromSegments(
  segments: WhisperSegment[],
  totalDuration: number
): KeepInterval[] {
  const merged: KeepInterval[] = []
  for (const s of segments) {
    const start = clamp(s.start - EDGE_PAD_SEC, 0, totalDuration)
    const end = clamp(s.end + EDGE_PAD_SEC, 0, totalDuration)
    const prev = merged[merged.length - 1]
    // Without word timings the segment edge is the only anchor we have, so
    // the bar for cutting at all is the same long-pause threshold.
    if (prev && start - prev.end < MIN_CUT_GAP_SEC) {
      prev.end = Math.max(prev.end, end)
      prev.text = `${prev.text} ${s.text.trim()}`.trim()
    } else {
      merged.push({ start, end, text: s.text.trim() })
    }
  }
  return merged.filter(
    (k) => merged.length === 1 || k.end - k.start >= MIN_FRAGMENT_SEC
  )
}

export function planCuts(
  segments: WhisperSegment[],
  words: WhisperWord[],
  totalDuration: number,
  /** Segment ids the retake pass asked to remove. */
  retakeDropIds: Set<number> = new Set()
): CutsPlan {
  let fillerCount = 0
  const dropRanges: Range[] = []
  const live: WhisperSegment[] = []

  for (const s of segments) {
    if (retakeDropIds.has(s.id)) {
      dropRanges.push({ start: s.start, end: s.end })
      continue
    }
    if (isPureFiller(s.text)) {
      fillerCount += 1
      dropRanges.push({ start: s.start, end: s.end })
      continue
    }
    live.push(s)
  }

  const allWords = usableWords(words)
  if (allWords.length > 0) {
    const { keep, kept, refused } = planFromWords(
      allWords,
      dropRanges,
      totalDuration
    )
    return {
      keep,
      cues: live.map((s) => ({ start: s.start, end: s.end, text: s.text.trim() })),
      words: kept,
      duration_in_sec: totalDuration,
      duration_out_sec: keep.reduce((acc, k) => acc + (k.end - k.start), 0),
      filler_count: fillerCount,
      silence_count: Math.max(0, keep.length - 1),
      refused_count: refused,
    }
  }

  const keep = planFromSegments(live, totalDuration)
  return {
    keep,
    cues: live.map((s) => ({ start: s.start, end: s.end, text: s.text.trim() })),
    words: [],
    duration_in_sec: totalDuration,
    duration_out_sec: keep.reduce((acc, k) => acc + (k.end - k.start), 0),
    filler_count: fillerCount,
    silence_count: Math.max(0, keep.length - 1),
    refused_count: 0,
  }
}
