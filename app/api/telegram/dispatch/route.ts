import { NextResponse } from 'next/server'
import { TEAM } from '@/lib/team/personas'
import { dispatchHandoff } from '@/lib/team/handoffs'
import { tgSend } from '@/lib/team/telegram'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Dispatcher runs the long-tail work the webhook can't fit in 30s
// (Marek's full writer→critic→render is ~2-4 minutes). Vercel Pro
// allows up to 300s — stay inside that.
export const maxDuration = 300

interface DispatchBody {
  clinicId: string
  chatId: number | string
  agentKey: string
  intent: string
  params: Record<string, unknown>
  userMessage: string
  userName?: string
}

function checkSecret(req: Request): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!expected) return true
  return req.headers.get('x-internal-dispatch-secret') === expected
}

export async function POST(req: Request) {
  if (!checkSecret(req)) {
    return NextResponse.json({ error: 'invalid secret' }, { status: 401 })
  }

  let body: DispatchBody
  try {
    body = (await req.json()) as DispatchBody
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const agent = TEAM.find((a) => a.key === body.agentKey) ?? TEAM[0]

  try {
    await dispatchHandoff({
      intent: body.intent,
      toolParams: body.params,
      ctx: {
        clinicId: body.clinicId,
        chatId: body.chatId,
        agent,
        userMessage: body.userMessage,
        userName: body.userName,
      },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    // Surface to user too — silence here means the operator just
    // sees the ack with no follow-up and assumes we're hung.
    await tgSend(
      body.chatId,
      `${agent.emoji} *${agent.name}*\n\n_(dispatch error: ${msg})_`
    )
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
