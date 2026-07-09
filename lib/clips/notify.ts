import { sendPushToClinic } from '@/lib/push/send'
import type { ProcessClipResult } from './pipeline'

// "Clip ready" web-push ping (HANDOFF §22.2 п.9 — channel decided
// 2026-07-06: web push + in-app badge; Telegram is removed from the
// product). Best-effort: never throws, a lost ping never fails a
// processed clip.

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export async function notifyClipCleaned(params: {
  clinicId: string
  clipName: string
  result: ProcessClipResult
}): Promise<void> {
  try {
    const r = params.result
    const stats = [
      `${fmtDuration(r.duration_in_sec)} → ${fmtDuration(r.duration_out_sec)}`,
      `${r.filler_count} filler`,
      `${r.silence_count} silence`,
      ...(r.retake_count > 0 ? [`${r.retake_count} retakes`] : []),
    ].join(' · ')

    await sendPushToClinic(params.clinicId, {
      title: 'Clip ready',
      body: `${params.clipName}\n${stats}`,
      url: `/clips?clinicId=${params.clinicId}`,
    })
  } catch (e) {
    console.warn(
      `clips: notifyClipCleaned failed (non-fatal) — ${e instanceof Error ? e.message : 'unknown'}`
    )
  }
}
