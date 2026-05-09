import { spawn } from 'node:child_process'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import type { KeepInterval } from './cuts'

// All ffmpeg invocations the /clips pipeline needs. We run the
// static binary via child_process.spawn — works on Vercel functions
// (the binary is bundled by @ffmpeg-installer/ffmpeg). Output is
// streamed to /tmp; we never load full mp4s into memory.

const FFMPEG_PATH: string = (ffmpegInstaller as { path: string }).path

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const proc = spawn(FFMPEG_PATH, args, { stdio: ['ignore', 'pipe', 'pipe'] })
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

// Burn captions onto a video. Reels-style readable defaults — bold
// white with a thick black box, bottom-centered. force_style accepts
// libass parameters; values must NOT contain unescaped quotes.
export async function burnCaptions(
  inputPath: string,
  srtPath: string,
  outputPath: string
): Promise<void> {
  // Escape srt path for ffmpeg's filter syntax: drive letters, colons
  // and backslashes are special. On Linux/Vercel a plain absolute
  // path works.
  const escapedSrt = srtPath.replace(/:/g, '\\:').replace(/'/g, "\\'")
  const style = [
    'Fontname=Arial',
    'Fontsize=22',
    'PrimaryColour=&H00FFFFFF',
    'OutlineColour=&H00000000',
    'BackColour=&H80000000',
    'BorderStyle=3',
    'Outline=2',
    'Shadow=0',
    'Alignment=2',
    'MarginV=60',
  ].join(',')

  await runFfmpeg([
    '-y',
    '-i',
    inputPath,
    '-vf',
    `subtitles=${escapedSrt}:force_style='${style}'`,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '23',
    '-c:a',
    'copy',
    '-movflags',
    '+faststart',
    outputPath,
  ])
}
