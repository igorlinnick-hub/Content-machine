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

// Same as runFfmpeg but hands back stderr on success — the probes
// below read ffmpeg's own progress line instead of shelling out to
// ffprobe, which the deploy does not bundle.
function runFfmpegCapture(args: string[]): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const proc = spawn(ffmpegPath(), args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
      if (stderr.length > 8192) stderr = stderr.slice(-8192)
    })
    proc.on('error', (err) => reject(err))
    proc.on('close', (code) => {
      if (code === 0) resolve(stderr)
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.trim()}`))
    })
  })
}

// Measure the source's REAL frame rate from the media itself, because
// the container cannot be trusted.
//
// Browser MediaRecorder writes junk timing into the mp4 it hands us:
// the teleprompter take we debugged declared 600 fps and a duration of
// 7,158,280s (= 0xFFFFFFFF ticks), and one sample carried a duration of
// 4294967295. Every timing-aware ffmpeg path then broke — the `fps`
// filter duplicated that one frame forever (0.03x speed, so the render
// never finished inside the function's ceiling), `-vsync cfr` cut the
// video off at that sample (52 frames for 72s of audio), and `-vsync 0`
// dropped everything after it. The frames themselves are fine: 2177 of
// them, evenly spaced, drifting only 83ms from a perfect 30fps grid
// across the whole take.
//
// So: count the frames (forcing an input rate makes the demuxer ignore
// the junk durations) and divide by the AUDIO duration, which browsers
// get right. Both probes are demux-cheap — well under a second.
// Duration measured from the AUDIO track. Browsers write junk video
// timing (see probeSourceFps) but get audio right, and every caller here
// runs this against the normalized file anyway.
async function probeAudioSeconds(inputPath: string): Promise<number> {
  const aLog = await runFfmpegCapture([
    '-v', 'error',
    '-i', inputPath,
    '-map', '0:a:0',
    '-f', 'null', '-',
    '-stats',
  ])
  const t = aLog.match(/time=\s*(\d+):(\d\d):(\d\d(?:\.\d+)?)/g)?.pop()
  const parts = t?.match(/(\d+):(\d\d):(\d\d(?:\.\d+)?)/)
  return parts
    ? Number(parts[1]) * 3600 + Number(parts[2]) * 60 + Number(parts[3])
    : 0
}

/** Seconds of media, or 0 when it cannot be measured. */
export async function probeDurationSec(inputPath: string): Promise<number> {
  try {
    return await probeAudioSeconds(inputPath)
  } catch {
    return 0
  }
}

export async function probeSourceFps(inputPath: string): Promise<number> {
  const FALLBACK = 30
  try {
    const vLog = await runFfmpegCapture([
      '-v', 'error',
      // Any rate works here; it only has to override the junk so no
      // frame is dropped. The reported time is meaningless, the frame
      // count is not.
      '-r', '1000',
      '-i', inputPath,
      '-map', '0:v:0',
      '-f', 'null', '-',
      '-stats',
    ])
    const frames = Number(vLog.match(/frame=\s*(\d+)/g)?.pop()?.replace(/\D/g, ''))
    const seconds = await probeAudioSeconds(inputPath)

    if (!frames || !seconds) return FALLBACK
    const fps = frames / seconds
    // A real recording is 24-60fps. Anything outside that means a probe
    // we misread, and guessing wrong here would play the take back at
    // the wrong speed — fall back rather than ship slow motion.
    if (fps < 10 || fps > 120) return FALLBACK
    return Math.round(fps * 1000) / 1000
  } catch {
    return FALLBACK
  }
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

// Cut, frame and burn in ONE encode — the only generation there is
// (Igor 2026-09-03). This used to run on top of a full normalize pass, and
// two encodes of the whole take is what pinned the lambda: ~4x realtime on
// Hobby's single vCPU meant roughly 70 seconds of footage fitted in the 300s
// ceiling, so an ordinary two-minute teleprompter take could not be processed
// at all. The normalize pass existed to repair MediaRecorder's junk container
// timing, but the thing that actually repairs it is the measured `-r` INPUT
// rate below — and that works just as well applied here, to the one encode we
// still need. One generation also means one round of compression artefacts
// instead of two.
//
// Export per the BINDING rules: H.264 High, CRF 18, 30fps CFR, AAC 256k/48kHz,
// faststart, on the 1080x1920 Reels canvas.
export async function cutAndBurn(params: {
  inputPath: string
  outputPath: string
  intervals: KeepInterval[]
  subtitlePath: string
  // libass force_style for .srt burns; omit for .ass (style inside).
  forceStyle?: string
  /**
   * The source's MEASURED frame rate (probeSourceFps). Forced as an input
   * option so the demuxer hands every packet a uniform duration and the junk
   * sample durations a browser writes never reach the filter graph. Measured,
   * never hardcoded to 30 — forcing 30 on a 60fps phone take plays it back at
   * half speed.
   */
  inputFps: number
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
  // FILL the 9:16 frame, never letterbox (Igor 2026-07-23: tiny video in a
  // black sea is not Instagram format) — scale to cover 1080x1920 and
  // centre-crop the overflow, so a landscape webcam becomes a full-screen
  // talking head and a portrait phone take passes through. Framing happens
  // once, after the concat, and the captions are drawn on the finished canvas
  // so they land where the .ass says they do.
  parts.push(
    `[cv]scale=1080:1920:force_original_aspect_ratio=increase,` +
      `crop=1080:1920,setsar=1,${subFilter}[outv]`
  )

  await runFfmpeg([
    '-y',
    '-r',
    String(params.inputFps),
    '-i',
    inputPath,
    '-filter_complex',
    parts.join(';'),
    '-map',
    '[outv]',
    '-map',
    '[outa]',
    '-r',
    '30',
    '-vsync',
    'cfr',
    '-c:v',
    'libx264',
    '-profile:v',
    'high',
    '-pix_fmt',
    'yuv420p',
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
