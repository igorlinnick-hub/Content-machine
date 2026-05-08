import { NextResponse } from 'next/server'
import { pickAgentByKeyword, teamHelpText, TEAM } from '@/lib/team/personas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Telegram requires a fast 200 (within 30s). For long-running agent
// work we acknowledge fast and do the heavy task off-band; for v0 we
// only do quick replies.
export const maxDuration = 30

interface TgUpdate {
  update_id: number
  message?: {
    message_id: number
    chat: { id: number; type: string }
    from?: { id: number; username?: string; first_name?: string }
    text?: string
  }
}

async function tgSend(
  chatId: number,
  text: string,
  opts: { parseMode?: 'Markdown' | 'HTML' } = {}
) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: opts.parseMode ?? 'Markdown',
      disable_web_page_preview: true,
    }),
  }).catch(() => {})
}

function adminChatIds(): Set<string> {
  const raw = process.env.TELEGRAM_ADMIN_CHAT_IDS ?? ''
  return new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))
}

// Telegram bot can be optionally protected with a secret token in the
// X-Telegram-Bot-Api-Secret-Token header (set via setWebhook). When set
// here, reject anything that doesn't match.
function checkSecret(req: Request): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!expected) return true
  return req.headers.get('x-telegram-bot-api-secret-token') === expected
}

export async function POST(req: Request) {
  if (!checkSecret(req)) {
    return NextResponse.json({ error: 'invalid secret' }, { status: 401 })
  }

  let update: TgUpdate
  try {
    update = (await req.json()) as TgUpdate
  } catch {
    return NextResponse.json({ ok: true })
  }

  const msg = update.message
  if (!msg || !msg.text) return NextResponse.json({ ok: true })

  const chatId = msg.chat.id
  const text = msg.text.trim()

  // /start, /help — show team list (no admin gate, anyone can see).
  if (text === '/start' || text === '/help') {
    await tgSend(chatId, teamHelpText())
    return NextResponse.json({ ok: true })
  }

  // Admin gate.
  const admins = adminChatIds()
  if (admins.size > 0 && !admins.has(String(chatId))) {
    await tgSend(
      chatId,
      `Not authorised. Your chat id is \`${chatId}\` — ping the admin to add it to TELEGRAM_ADMIN_CHAT_IDS.`
    )
    return NextResponse.json({ ok: true })
  }

  // Route by keyword.
  const agent = pickAgentByKeyword(text)
  if (!agent) {
    await tgSend(
      chatId,
      `Not sure which agent should take this.\n\n${TEAM.map((a) => `${a.emoji} /${a.key} — ${a.role}`).join('\n')}\n\nTry /help for examples.`
    )
    return NextResponse.json({ ok: true })
  }

  // V0 — every agent acknowledges with their personality. Real handlers
  // (Marek calls /api/posts/generate, Ren calls /api/videos/generate,
  // etc) land in the next session after /exit so the claude-api skill
  // can guide the Agent SDK code properly.
  const stripped = text
    .replace(new RegExp(`^/${agent.key}\\s*`, 'i'), '')
    .trim()
  await tgSend(
    chatId,
    `${agent.emoji} *${agent.name}* here.\n\n_${agent.personality}_\n\nYou said:\n${stripped || '(empty)'}\n\n_Skeleton — full pipeline lands in the next session._`
  )
  return NextResponse.json({ ok: true })
}

// Health check for setting up the webhook from a browser.
export async function GET() {
  return NextResponse.json({
    ok: true,
    has_token: !!process.env.TELEGRAM_BOT_TOKEN,
    admin_count: adminChatIds().size,
  })
}
