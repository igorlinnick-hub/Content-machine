import { spawn } from 'node:child_process'
import { join } from 'node:path'
import type { KeepInterval } from './cuts'
import { resolveCaptionStyle } from './captionStyles'

// Bundled caption font (assets/fonts, traced into the lambda via
// next.config outputFileTracingIncludes) — Vercel has no system
// fonts, so libass must be pointed at ours explicitly.
function fontsDirArg(): string {
  const dir = join(process.cwd(), 'assets', 'fonts')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
  return `fontsdir='${dir}'`
}

// All ffmpeg invocations the /clips pipeline needs. We run the
// static binary via child_process.spawn — works on Vercel functions
// (the binary is bundled by @ffmpeg-installer/ffmpeg). Output is
// streamed to /tmp; we never load full mp4s into memory.
//
// IMPORTANT: ffmpeg-installer is lazy-required (not top-level
// import) because it dynamically resolves a platform-specific
// sub-package at runtime. Pulling it in at module-load time makes
// Next.js's build-time "collecting page data" step crash when the
// build host's OS sub-package isn't installed — and the /clips
// route is gated by ENABLE_LLM_AGENTS anyway, so the binary is
// only ever needed at request time.

let _ffmpegPath: string | null = null
function ffmpegPath(): string {
  if (_ffmpegPath) return _ffmpegPath
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const installer = require('@ffmpeg-installer/ffmpeg') as { path: string }
  _ffmpegPath = installer.path
  return _ffmpegPath
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const proc = spawn(ffmpegPath(), args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    proc.stderr.on('data', (chunk: Buffer) => {
      // Keep last ~4kb so error messages survive long encodes
      // without holding the full ffmpeg log in memory.
      stderr += chunk.toString('utf8')
      if (stderr.length > 4096) stderr = stderr.slice(-4096)
    })
    proc.on('error', (err) => reject(err))
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.trim()}`))
    })
  })
}

// Strip video track and downmix audio to a tiny mono mp3 for
// Whisper. Whisper accepts files up to 25MB; 64kbps mono mp3 stays
// well under that for clips up to ~50 minutes.
export async function extractAudioMp3(
  inputPath: string,
  outputPath: string
): Promise<void> {
  await runFfmpeg([
    '-y',
    '-i',
    inputPath,
    '-vn',
    '-ac',
    '1',
    '-ar',
    '16000',
    '-b:a',
    '64k',
    '-f',
    'mp3',
    outputPath,
  ])
}

// Re-encode ANY source into a clean 30fps CFR file on the Reels 9:16
// canvas (1080x1920, scale + centered pad — the local video bot's
// rule) BEFORE anything else touches it. MediaRecorder webm ships
// broken timestamps: cutting it directly produced files claiming
// "2h44m at 0.0003 fps", which killed the caption burn ("Too many
// packets buffered"). Whisper audio is extracted from THIS file so
// transcript timestamps and video share one timeline.
export async function normalizeSource(
  inputPath: string,
  outputPath: string
): Promise<void> {
  await runFfmpeg([
    '-y',
    '-i',
    inputPath,
    '-vf',
    // FILL the 9:16 frame, never letterbox (Igor, 2026-07-23: tiny
    // video in a black sea is not Instagram format). Scale to cover
    // 1080x1920, center-crop the overflow — webcam landscape becomes
    // a full-screen talking head; phone portrait passes through.
    'scale=1080:1920:force_original_aspect_ratio=increase,' +
      'crop=1080:1920,setsar=1,fps=30',
    // Intermediate master: near-lossless so the final encode is the
    // only visible generation (Правила монтажа: ≤2 поколений).
    '-c:v',
    'libx264',
    '-preset',
    'fast',
    '-crf',
    '17',
    '-c:a',
    'aac',
    '-b:a',
    '256k',
    '-ar',
    '48000',
    '-max_muxing_queue_size',
    '1024',
    '-movflags',
    '+faststart',
    outputPath,
  ])
}

// Cuts + caption burn in a SINGLE encode — the final generation.
// (Previously cut and burn were two back-to-back CRF-23/veryfast
// encodes on top of normalize = three visible generations; that was
// the «пиксельная залупа».) Export per the BINDING rules: H.264
// High, CRF 18, 30fps, AAC 256k/48kHz, faststart.
export async function cutAndBurn(params: {
  inputPath: string
  outputPath: string
  intervals: KeepInterval[]
  subtitlePath: string
  // libass force_style for .srt burns; omit for .ass (style inside).
  forceStyle?: string
}): Promise<void> {
  const { inputPath, outputPath, intervals, subtitlePath, forceStyle } = params
  if (intervals.length === 0) {
    throw new Error('cutAndBurn: no intervals to keep — nothing to render')
  }
  const parts: string[] = []
  for (let i = 0; i < intervals.length; i++) {
    const { start, end } = intervals[i]
    parts.push(
      `[0:v]trim=start=${start.toFixed(3)}:end=${end.toFixed(3)},setpts=PTS-STARTPTS[v${i}]`,
      `[0:a]atrim=start=${start.toFixed(3)}:end=${end.toFixed(3)},asetpts=PTS-STARTPTS[a${i}]`
    )
  }
  const concatInputs = intervals.map((_, i) => `[v${i}][a${i}]`).join('')
  parts.push(`${concatInputs}concat=n=${intervals.length}:v=1:a=1[cv][outa]`)

  const escapedSub = subtitlePath.replace(/:/g, '\\:').replace(/'/g, "\\'")
  const subFilter = forceStyle
    ? `subtitles=${escapedSub}:${fontsDirArg()}:force_style='${forceStyle}'`
    : `subtitles=${escapedSub}:${fontsDirArg()}`
  parts.push(`[cv]${subFilter}[outv]`)

  await runFfmpeg([
    '-y',
    '-i',
    inputPath,
    '-filter_complex',
    parts.join(';'),
    '-map',
    '[outv]',
    '-map',
    '[outa]',
    '-c:v',
    'libx264',
    '-profile:v',
    'high',
    '-preset',
    'fast',
    '-crf',
    '18',
    '-c:a',
    'aac',
    '-b:a',
    '256k',
    '-ar',
    '48000',
    '-max_muxing_queue_size',
    '1024',
    '-movflags',
    '+faststart',
    outputPath,
  ])
}

// Apply the cut plan via ffmpeg's concat filter. Each kept interval
// becomes one trim/atrim pair; concat stitches them. Re-encodes
// because trim outputs uncompressed and we need a portable mp4.
export async function applyCuts(
  inputPath: string,
  outputPath: string,
  intervals: KeepInterval[]
): Promise<void> {
  if (intervals.length === 0) {
    throw new Error('applyCuts: no intervals to keep — nothing to render')
  }
  // Build filter graph: per-interval trim + atrim, then concat.
  const parts: string[] = []
  for (let i = 0; i < intervals.length; i++) {
    const { start, end } = intervals[i]
    parts.push(
      `[0:v]trim=start=${start.toFixed(3)}:end=${end.toFixed(3)},setpts=PTS-STARTPTS[v${i}]`,
      `[0:a]atrim=start=${start.toFixed(3)}:end=${end.toFixed(3)},asetpts=PTS-STARTPTS[a${i}]`
    )
  }
  const concatInputs = intervals
    .map((_, i) => `[v${i}][a${i}]`)
    .join('')
  parts.push(
    `${concatInputs}concat=n=${intervals.length}:v=1:a=1[outv][outa]`
  )
  const filter = parts.join(';')

  await runFfmpeg([
    '-y',
    '-i',
    inputPath,
    '-filter_complex',
    filter,
    '-map',
    '[outv]',
    '-map',
    '[outa]',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '23',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-movflags',
    '+faststart',
    outputPath,
  ])
}

// Burn an .ass subtitle file (animated karaoke captions). The style
// lives inside the ASS itself — no force_style needed; libass renders
// the \k word-fill natively.
export async function burnAssCaptions(
  inputPath: string,
  assPath: string,
  outputPath: string
): Promise<void> {
  const escapedAss = assPath.replace(/:/g, '\\:').replace(/'/g, "\\'")
  await runFfmpeg([
    '-y',
    '-i',
    inputPath,
    '-vf',
    `subtitles=${escapedAss}:${fontsDirArg()}`,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '23',
    '-c:a',
    'copy',
    '-max_muxing_queue_size',
    '1024',
    '-movflags',
    '+faststart',
    outputPath,
  ])
}

// Burn captions onto a video. Style comes from the clinic's caption
// preset (lib/clips/captionStyles.ts); omitted = classic look.
// force_style accepts libass parameters; values must NOT contain
// unescaped quotes.
export async function burnCaptions(
  inputPath: string,
  srtPath: string,
  outputPath: string,
  forceStyle?: string
): Promise<void> {
  // Escape srt path for ffmpeg's filter syntax: drive letters, colons
  // and backslashes are special. On Linux/Vercel a plain absolute
  // path works.
  const escapedSrt = srtPath.replace(/:/g, '\\:').replace(/'/g, "\\'")
  const style = forceStyle ?? resolveCaptionStyle(null).forceStyle

  await runFfmpeg([
    '-y',
    '-i',
    inputPath,
    '-vf',
    `subtitles=${escapedSrt}:${fontsDirArg()}:force_style='${style}'`,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '23',
    '-c:a',
    'copy',
    '-max_muxing_queue_size',
    '1024',
    '-movflags',
    '+faststart',
    outputPath,
  ])
}
