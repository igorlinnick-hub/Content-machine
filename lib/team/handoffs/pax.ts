import { listInboxClips, clipFolderUrl } from '@/lib/clips/drive'
import { loadRecentClips } from '@/lib/clips/store'
import { tgChatAction, tgSend } from '../telegram'
import { guardDisabledHandoff } from '@/lib/agents/disabled'

// Pax — clip cleanup. Two tools:
//   clip_clean  — process new files in the Drive Inbox folder
//   clip_status — list recent clips with status

export interface PaxHandoffContext {
  clinicId: string
  chatId: number | string
  agentEmoji: string
  agentName: string
}

// Pax handoff lives in the dispatch bundle, but the pipeline tools
// (ffmpeg + Whisper) live in /api/clips/process so the dispatch
// bundle stays small. We invoke that route via internal HTTP using
// the same shared secret as webhook→dispatch.
function clipsProcessUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
  if (fromEnv) return `${fromEnv}/api/clips/process`
  // Local dev fallback. In production NEXT_PUBLIC_APP_URL must be set.
  return 'http://localhost:3000/api/clips/process'
}

interface ProcessRouteResult {
  processed?: number
  results?: Array<
    | {
        ok: true
        name: string
        clip_id: string
        drive_folder_id: string
        cleaned_file_id: string
        duration_in_sec: number
        duration_out_sec: number
        filler_count: number
        silence_count: number
      }
    | { ok: false; name: string; error: string }
  >
  error?: string
}

function fmtDuration(sec: number | null | undefined): string {
  if (sec == null || !isFinite(sec)) return 'n/a'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export async function runPaxClipClean(ctx: PaxHandoffContext): Promise<void> {
  // OpenAI Whisper API is pay-per-use (~$0.02/min). Gate behind the
  // same kill-switch as Anthropic so subscription-only mode is total.
  if (await guardDisabledHandoff(ctx, 'Clip cleanup (Whisper)')) return
  let inbox
  try {
    inbox = await listInboxClips()
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    await tgSend(
      ctx.chatId,
      `${ctx.agentEmoji} *${ctx.agentName}*\n\n_(inbox unreachable: ${msg})_`
    )
    return
  }

  if (inbox.length === 0) {
    await tgSend(
      ctx.chatId,
      `${ctx.agentEmoji} *${ctx.agentName}*\n\nInbox is empty. Drop an .mp4 / .mov in the Drive *Clips/Inbox* folder and ping me again.`
    )
    return
  }

  await tgSend(
    ctx.chatId,
    `${ctx.agentEmoji} *${ctx.agentName}*\n\nFound ${inbox.length} clip${inbox.length === 1 ? '' : 's'} in Inbox. Starting with *${inbox[0].name}* — each takes 2-4 min for a 5-min clip.`
  )
  await tgChatAction(ctx.chatId, 'upload_photo')

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET ?? ''
  let payload: ProcessRouteResult
  try {
    const res = await fetch(clipsProcessUrl(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-dispatch-secret': secret,
      },
      body: JSON.stringify({
        clinicId: ctx.clinicId,
        triggeredChatId: String(ctx.chatId),
      }),
    })
    payload = (await res.json()) as ProcessRouteResult
    if (!res.ok) {
      throw new Error(payload.error ?? `process ${res.status}`)
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    await tgSend(
      ctx.chatId,
      `${ctx.agentEmoji} *${ctx.agentName}*\n\n_(pipeline error: ${msg})_`
    )
    return
  }

  for (const r of payload.results ?? []) {
    if (r.ok) {
      const savedSec = r.duration_in_sec - r.duration_out_sec
      const text = [
        `${ctx.agentEmoji} *${ctx.agentName}* — *${r.name}* cleaned`,
        ``,
        `Duration: ${fmtDuration(r.duration_in_sec)} → *${fmtDuration(r.duration_out_sec)}* (saved ${fmtDuration(savedSec)})`,
        `Cuts: ${r.filler_count} filler${r.filler_count === 1 ? '' : 's'} + ${r.silence_count} silence${r.silence_count === 1 ? '' : 's'}`,
        ``,
        `Drive folder: ${clipFolderUrl(r.drive_folder_id)}`,
      ].join('\n')
      await tgSend(ctx.chatId, text, { disablePreview: false })
    } else {
      await tgSend(
        ctx.chatId,
        `${ctx.agentEmoji} *${ctx.agentName}*\n\n_(failed on ${r.name}: ${r.error})_`
      )
    }
  }
}

export async function runPaxClipStatus(ctx: PaxHandoffContext): Promise<void> {
  try {
    const rows = await loadRecentClips(ctx.clinicId, 10)
    if (rows.length === 0) {
      await tgSend(
        ctx.chatId,
        `${ctx.agentEmoji} *${ctx.agentName}*\n\nNo clips processed yet.`
      )
      return
    }
    const lines = rows.map((r) => {
      const flag =
        r.status === 'cleaned'
          ? '🟢'
          : r.status === 'failed'
            ? '🔴'
            : r.status === 'processing'
              ? '🟡'
              : '⚪'
      const link = r.drive_clip_folder_id
        ? clipFolderUrl(r.drive_clip_folder_id)
        : null
      return `${flag} *${r.drive_inbox_file_name}* — ${r.status}${link ? `\n  ${link}` : ''}${r.error ? `\n  err: ${r.error}` : ''}`
    })
    await tgSend(
      ctx.chatId,
      `${ctx.agentEmoji} *${ctx.agentName}* — recent clips\n\n${lines.join('\n\n')}`,
      { disablePreview: true }
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    await tgSend(
      ctx.chatId,
      `${ctx.agentEmoji} *${ctx.agentName}*\n\n_(status failed: ${msg})_`
    )
  }
}
