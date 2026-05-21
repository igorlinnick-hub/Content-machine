import {
  confirmArsenalRow,
  deleteArsenalRow,
  findArsenalByLabel,
  loadArsenal,
  loadUnresolvedIngests,
  setArsenalActive,
} from '@/lib/arsenal/store'
import { tgSend } from '../telegram'

// Archy — keeper of the script_arsenal. Handles the doctor's
// post-ingestion choices via TG. URL detection / enqueue is upstream
// in the webhook; extraction happens offline via the local Claude Code
// skill. Archy only deals with the operator commands that follow:
//   arsenal_list   — render the inventory with status flags
//   arsenal_toggle — flip is_active on / off for a style
//   arsenal_confirm — flip a draft (awaiting_confirm) into the rotation
//   arsenal_drop    — hard-delete a style row

export interface ArchyContext {
  clinicId: string
  chatId: number | string
  agentEmoji: string
  agentName: string
}

function flag(row: { is_active: boolean; confirmed_at: string | null }): string {
  if (row.is_active) return '🟢'
  if (row.confirmed_at) return '⚪' // confirmed once, now disabled
  return '🟡' // never confirmed — still a draft
}

function queueIcon(status: string): string {
  if (status === 'processing') return '🌀'
  if (status === 'failed') return '🔴'
  return '🕐' // pending
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url)
    const tail = u.pathname.replace(/\/$/, '').split('/').pop() ?? ''
    return `${u.hostname}/…/${tail}`
  } catch {
    return url.slice(0, 60)
  }
}

export async function runArchyList(ctx: ArchyContext): Promise<void> {
  try {
    const [rows, pending] = await Promise.all([
      loadArsenal(ctx.clinicId, { limit: 30 }),
      loadUnresolvedIngests(ctx.clinicId, 10),
    ])
    if (rows.length === 0 && pending.length === 0) {
      await tgSend(
        ctx.chatId,
        `${ctx.agentEmoji} *${ctx.agentName}*\n\nАрсенал пуст. Кинь IG/YT/TikTok ссылку — извлеку структуру и хуки.`
      )
      return
    }
    const parts: string[] = []
    if (rows.length > 0) {
      const lines = rows.map((r) => {
        const desc = r.style_description ? ` — ${r.style_description}` : ''
        const hookCount = Array.isArray(r.hooks) ? r.hooks.length : 0
        return `${flag(r)} \`${r.style_label}\`${desc}\n  hooks: ${hookCount} · ${r.source_platform ?? '?'}`
      })
      parts.push(`*Arsenal (${rows.length})*\n\n${lines.join('\n\n')}`)
    }
    if (pending.length > 0) {
      const lines = pending.map((q) => {
        const err = q.error ? `\n  err: ${q.error.slice(0, 80)}` : ''
        return `${queueIcon(q.status)} ${shortUrl(q.source_url)} (${q.status})${err}`
      })
      parts.push(`*In queue (${pending.length})*\n\n${lines.join('\n')}`)
    }
    const legend = '🟢 active · ⚪ off · 🟡 awaiting confirm · 🕐 queued · 🌀 processing · 🔴 failed'
    await tgSend(
      ctx.chatId,
      `${ctx.agentEmoji} *${ctx.agentName}*\n\n${parts.join('\n\n')}\n\n_${legend}_\n\nКоманды: *"arsenal off <label>"*, *"arsenal on <label>"*, *"arsenal drop <label>"*`,
      { disablePreview: true }
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    await tgSend(
      ctx.chatId,
      `${ctx.agentEmoji} *${ctx.agentName}*\n\n_(list failed: ${msg})_`
    )
  }
}

async function resolveLabel(
  ctx: ArchyContext,
  label: string
): Promise<{ id: string; label: string } | null> {
  if (!label) return null
  const row = await findArsenalByLabel(ctx.clinicId, label)
  if (!row) return null
  return { id: row.id, label: row.style_label }
}

export async function runArchyConfirm(
  ctx: ArchyContext,
  args: { label: string }
): Promise<void> {
  const found = await resolveLabel(ctx, args.label)
  if (!found) {
    await tgSend(
      ctx.chatId,
      `${ctx.agentEmoji} *${ctx.agentName}*\n\nНе нашёл стиль \`${args.label}\`. Напиши *"arsenal list"*.`
    )
    return
  }
  const row = await confirmArsenalRow(found.id, ctx.clinicId)
  if (!row) {
    await tgSend(
      ctx.chatId,
      `${ctx.agentEmoji} *${ctx.agentName}*\n\n_(confirm не удался — попробуй ещё раз)_`
    )
    return
  }
  await tgSend(
    ctx.chatId,
    `${ctx.agentEmoji} *${ctx.agentName}*\n\n🟢 Стиль \`${row.style_label}\` в активной ротации + добавлен в Templates. Видно в \`/arsenal\` на сайте; Marek подхватит в следующем посте.`
  )
}

export async function runArchyToggle(
  ctx: ArchyContext,
  args: { label: string; active: boolean }
): Promise<void> {
  const found = await resolveLabel(ctx, args.label)
  if (!found) {
    await tgSend(
      ctx.chatId,
      `${ctx.agentEmoji} *${ctx.agentName}*\n\nНе нашёл стиль \`${args.label}\`.`
    )
    return
  }
  const row = await setArsenalActive(found.id, ctx.clinicId, args.active)
  if (!row) {
    await tgSend(
      ctx.chatId,
      `${ctx.agentEmoji} *${ctx.agentName}*\n\n_(toggle не удался)_`
    )
    return
  }
  const icon = row.is_active ? '🟢 on' : '⚪ off'
  await tgSend(
    ctx.chatId,
    `${ctx.agentEmoji} *${ctx.agentName}*\n\n${icon} → \`${row.style_label}\``
  )
}

export async function runArchyDrop(
  ctx: ArchyContext,
  args: { label: string }
): Promise<void> {
  const found = await resolveLabel(ctx, args.label)
  if (!found) {
    await tgSend(
      ctx.chatId,
      `${ctx.agentEmoji} *${ctx.agentName}*\n\nНе нашёл стиль \`${args.label}\`.`
    )
    return
  }
  const ok = await deleteArsenalRow(found.id, ctx.clinicId)
  await tgSend(
    ctx.chatId,
    ok
      ? `${ctx.agentEmoji} *${ctx.agentName}*\n\n🗑 \`${found.label}\` удалён.`
      : `${ctx.agentEmoji} *${ctx.agentName}*\n\n_(удаление не прошло)_`
  )
}
