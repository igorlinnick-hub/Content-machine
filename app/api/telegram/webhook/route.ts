import { NextResponse } from 'next/server'
import { TEAM } from '@/lib/team/personas'
import { routeAndReply } from '@/lib/team/router-agent'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Telegram requires fast 200 (within 30s). For long agent work we
// return 200 first and run async.
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

async function tgChatAction(chatId: number, action: 'typing') {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return
  await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action }),
  }).catch(() => {})
}

function adminChatIds(): Set<string> {
  const raw = process.env.TELEGRAM_ADMIN_CHAT_IDS ?? ''
  return new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))
}

function checkSecret(req: Request): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!expected) return true
  return req.headers.get('x-telegram-bot-api-secret-token') === expected
}

function teamIntroText(): string {
  return [
    'Hey 👋 I am the content team.',
    '',
    "Just message me normally — there's no command syntax. You can address someone by name (\"Marek, draft a post on TMS\") or just describe what you need (\"I need a 5s video about ketamine\") and the right person will pick it up.",
    '',
    'Who you can talk to here:',
    '',
    ...TEAM.map((a) => `${a.emoji} *${a.name}* — ${a.role}`),
    '',
    'For ads / leads / billing reports, talk to @hawaiiwellnessclinicbot instead.',
  ].join('\n')
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
  const userName =
    msg.from?.first_name ?? msg.from?.username ?? `user_${msg.from?.id ?? '?'}`

  // Hard-coded onboarding so a fresh /start gets immediate context
  // without spending a Haiku call.
  if (text === '/start' || text === '/help') {
    await tgSend(chatId, teamIntroText())
    return NextResponse.json({ ok: true })
  }

  // Admin gate. Non-admins see who they are so they can ask for access.
  const admins = adminChatIds()
  if (admins.size > 0 && !admins.has(String(chatId))) {
    await tgSend(
      chatId,
      `I don't recognise this chat yet — your id is \`${chatId}\`. Ping the admin to add it to the allow-list.`
    )
    return NextResponse.json({ ok: true })
  }

  // "typing…" indicator while the router thinks.
  await tgChatAction(chatId, 'typing')

  try {
    const { agent, reply } = await routeAndReply({
      userMessage: text,
      userName,
      botSurface: 'content',
    })
    await tgSend(chatId, `${agent.emoji} *${agent.name}*\n\n${reply}`)
  } catch (e) {
    const msgText = e instanceof Error ? e.message : 'router failed'
    await tgSend(chatId, `_(router error: ${msgText})_`)
  }
  return NextResponse.json({ ok: true })
}

// Health probe for setting up webhook from a browser.
export async function GET() {
  return NextResponse.json({
    ok: true,
    has_token: !!process.env.TELEGRAM_BOT_TOKEN,
    admin_count: adminChatIds().size,
    team: TEAM.map((a) => ({ name: a.name, role: a.role })),
  })
}
