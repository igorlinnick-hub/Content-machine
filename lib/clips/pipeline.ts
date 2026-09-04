import { mkdtemp, readFile, writeFile, unlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createClipFolder,
  downloadDriveFileToBuffer,
  moveFileToFolder,
  uploadFileToFolder,
  type InboxClip,
} from './drive'
import { transcribeAudio, type WhisperResult } from './whisper'
import { planCuts } from './cuts'
import { detectRetakeDrops } from './retakes'
import {
  getClinicDriveFolders,
  type ClinicDriveFolders,
} from '@/lib/google/clinicFolders'
import { allowLinkView } from '@/lib/google/drive'
import {
  cutAndBurn,
  extractAudioMp3,
  probeDurationSec,
  probeSourceFps,
} from './ffmpeg'
import { buildKaraokeAss } from './ass'
import { buildSrt } from './srt'
import {
  getClinicCaptionStyle,
  markClipCleaned,
  markClipFailed,
  markClipProcessing,
  markClipStage,
  upsertPendingClip,
} from './store'
import { resolveCaptionStyle } from './captionStyles'

// Orchestrate the full clip cleanup. Caller passes one InboxClip; we
// download → extract audio → Whisper → plan cuts → ffmpeg cut →
// generate SRT → ffmpeg caption burn-in → upload all artifacts to
// a per-clip Drive folder → move original out of Inbox.
//
// Errors at any stage are caught, the clip row is marked failed
// with the error message, and the original file STAYS in Inbox so
// the operator can retry without re-uploading.

export interface ProcessClipResult {
  clip_id: string
  drive_folder_id: string
  cleaned_file_id: string
  duration_in_sec: number
  duration_out_sec: number
  filler_count: number
  silence_count: number
  retake_count: number
  transcript_text: string
}

function safeFolderName(originalName: string): string {
  // Strip extension, normalize whitespace, prefix with date so the
  // operator's Drive listing sorts chronologically.
  const date = new Date().toISOString().slice(0, 10)
  const stem = originalName.replace(/\.[^.]+$/, '').slice(0, 60)
  const cleaned = stem.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/_+/g, '_')
  return `${date}_${cleaned || 'clip'}`
}

export async function processClip(params: {
  clinicId: string
  inboxClip: InboxClip
  // Per-clinic Drive folders. Pass explicitly when the caller already
  // resolved them (cron); omit to resolve here; null = force legacy
  // global env folders.
  folders?: ClinicDriveFolders | null
}): Promise<ProcessClipResult> {
  const { clinicId, inboxClip } = params

  // Per-clinic layout when the clinic has provisioned folders,
  // legacy global env folders otherwise (HWC today).
  const folders =
    params.folders !== undefined
      ? params.folders
      : await getClinicDriveFolders(clinicId)

  // Register the clip first so failures still leave a row.
  const { id: clipId } = await upsertPendingClip({
    clinicId,
    driveInboxFileId: inboxClip.id,
    driveInboxFileName: inboxClip.name,
  })
  await markClipProcessing(clipId)

  const work = await mkdtemp(join(tmpdir(), 'clip-'))
  const rawPath = join(work, 'raw.mp4')
  const audioPath = join(work, 'audio.mp3')
  const srtPath = join(work, 'transcript.srt')
  const finalPath = join(work, 'final.mp4')

  // Stage breadcrumbs carry seconds-since-start so a stuck row shows
  // both where the run died and how long it had been alive.
  const startedAt = Date.now()
  const stage = (name: string) =>
    markClipStage(
      clipId,
      `${name} (t+${Math.round((Date.now() - startedAt) / 1000)}s)`
    ).catch(() => {})

  try {
    // 1. Download from Drive.
    await stage('download')
    const rawBuf = await downloadDriveFileToBuffer(inboxClip.id)
    await writeFile(rawPath, rawBuf)

    // 1b. Measure the source instead of re-encoding it. The container
    //     cannot be trusted (a browser take declared 600fps), so the real
    //     rate is counted off the media and forced on the single encode
    //     later; the duration comes off the audio track, which browsers
    //     get right. Both probes only demux — under a second each.
    await stage('probe')
    const inputFps = await probeSourceFps(rawPath)
    const mediaDuration = await probeDurationSec(rawPath)

    // 2. Extract low-bitrate mono mp3 for Whisper, then drop raw
    //    bytes from memory to save heap. Audio comes off the SAME file the
    //    trims will run on, so transcript time and video time are one
    //    timeline.
    await stage('audio')
    await extractAudioMp3(rawPath, audioPath)
    const audioBuf = await readFile(audioPath)

    // 3. Transcribe.
    await stage('whisper')
    const whisper: WhisperResult = await transcribeAudio({
      audio: audioBuf,
      fileName: 'audio.mp3',
    })
    // Audio buffer no longer needed.
    await unlink(audioPath).catch(() => {})

    // 4. Retake pass (Sonnet, fail-open): drop abandoned takes
    //    ("let me start over" + the flubbed line before it) so they
    //    never reach the cut plan. On any error this returns zero
    //    drops and the pipeline continues with filler/silence only.
    await stage('retakes')
    const retakes = await detectRetakeDrops(whisper.segments)

    // 5. Plan cuts.
    // The media's own duration, not the last segment's end — Whisper stops
    // timing where speech stops, and clamping the tail to that would shave
    // whatever the doctor left after the final word.
    const plan = planCuts(
      whisper.segments,
      whisper.words,
      mediaDuration || whisper.duration,
      retakes.dropIds
    )
    if (plan.refused_count > 0) {
      // Not an error: the planner found no silence it could cut in and kept
      // the flub rather than clipping the words around it.
      console.warn(
        `clips: ${plan.refused_count} cut(s) refused — no silence to cut in`
      )
    }
    if (plan.keep.length === 0) {
      throw new Error(
        'cut planner produced 0 keep intervals — clip is all filler / silence?'
      )
    }

    // 6-8. SRT (phrase-level cues remapped to the cut timeline) +
    //    cuts + caption burn in ONE encode — the only visible
    //    generation on top of the near-lossless normalize
    //    (Правила монтажа: ≤2 поколений кодирования).
    const srt = buildSrt({ words: plan.words, cues: plan.cues, keep: plan.keep })
    await writeFile(srtPath, srt, 'utf8')

    const captionStyle = resolveCaptionStyle(
      await getClinicCaptionStyle(clinicId)
    )
    await stage('cut+burn')
    if (captionStyle.animated && captionStyle.ass && plan.words.length > 0) {
      const assPath = srtPath.replace(/\.srt$/, '.ass')
      const ass = buildKaraokeAss(plan.words, plan.keep, captionStyle.ass)
      await writeFile(assPath, ass, 'utf8')
      await cutAndBurn({
        inputPath: rawPath,
        inputFps,
        outputPath: finalPath,
        intervals: plan.keep,
        subtitlePath: assPath,
      })
      await unlink(assPath).catch(() => {})
    } else {
      await cutAndBurn({
        inputPath: rawPath,
        inputFps,
        outputPath: finalPath,
        intervals: plan.keep,
        subtitlePath: srtPath,
        forceStyle: captionStyle.forceStyle,
      })
    }
    await unlink(rawPath).catch(() => {})

    // 9. Upload artifacts to a per-clip folder — under the clinic's
    //    Finals/ or the legacy global Cleaned/.
    await stage('upload')
    const folderName = safeFolderName(inboxClip.name)
    const folderId = await createClipFolder(folderName, folders?.finalsId)

    const finalBuf = await readFile(finalPath)
    const cleanedFileId = await uploadFileToFolder({
      folderId,
      name: 'cleaned.mp4',
      mimeType: 'video/mp4',
      body: finalBuf,
    })
    // Link-view permission so the Ready videos player works no matter
    // which Google account the admin's browser holds. Best-effort.
    await allowLinkView(cleanedFileId).catch(() => {})

    const transcriptTxt = whisper.text || plan.keep.map((k) => k.text).join(' ')
    const transcriptTxtBuf = Buffer.from(transcriptTxt, 'utf8')
    const transcriptTxtFileId = await uploadFileToFolder({
      folderId,
      name: 'transcript.txt',
      mimeType: 'text/plain',
      body: transcriptTxtBuf,
    })

    const srtBuf = Buffer.from(srt, 'utf8')
    const transcriptSrtFileId = await uploadFileToFolder({
      folderId,
      name: 'transcript.srt',
      mimeType: 'application/x-subrip',
      body: srtBuf,
    })

    // Word-level timestamps + the cut plan — raw material for the
    // transcript editor (edit-by-word, ms cuts, re-render without
    // re-transcribing). Best-effort: the cleaned clip is complete
    // without it, so an upload failure here must not fail the clip.
    if (whisper.words.length > 0) {
      const editData = JSON.stringify(
        {
          duration: whisper.duration,
          language: whisper.language,
          words: whisper.words,
          segments: whisper.segments,
          keep: plan.keep.map((k) => ({ start: k.start, end: k.end })),
        },
        null,
        1
      )
      await uploadFileToFolder({
        folderId,
        name: 'words.json',
        mimeType: 'application/json',
        body: Buffer.from(editData, 'utf8'),
      }).catch((e) => {
        console.warn(
          `clips: words.json upload failed (non-fatal) — ${e instanceof Error ? e.message : 'unknown'}`
        )
      })
    }

    // 10. Move the original out of Inbox so it empties. Per-clinic
    //     layout parks it in Originals/; legacy layout keeps the old
    //     behaviour (into the per-clip folder).
    await moveFileToFolder(
      inboxClip.id,
      folders ? folders.originalsId : folderId,
      folders?.inboxId
    )

    // 11. Mark cleaned in DB.
    await markClipCleaned({
      clipId,
      driveClipFolderId: folderId,
      durationInSec: plan.duration_in_sec,
      durationOutSec: plan.duration_out_sec,
      fillerCount: plan.filler_count,
      silenceCount: plan.silence_count,
      cleanedFileId,
      transcriptTxtFileId,
      transcriptSrtFileId,
    })

    return {
      clip_id: clipId,
      drive_folder_id: folderId,
      cleaned_file_id: cleanedFileId,
      duration_in_sec: plan.duration_in_sec,
      duration_out_sec: plan.duration_out_sec,
      filler_count: plan.filler_count,
      silence_count: plan.silence_count,
      retake_count: retakes.count,
      transcript_text: transcriptTxt,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    await markClipFailed(clipId, msg).catch(() => {})
    throw e
  } finally {
    // Best-effort cleanup. If a step crashed mid-pipeline, /tmp may
    // hold partial files — wipe the workdir to free space for the
    // next clip in the same warm container.
    await rm(work, { recursive: true, force: true }).catch(() => {})
  }
}
