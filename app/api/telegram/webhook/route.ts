import { NextResponse } from 'next/server'
import { TEAM } from '@/lib/team/personas'
import { routeAndReply } from '@/lib/team/router-agent'
import { loadTeamBrief } from '@/lib/team/brief'
import { tgChatAction, tgSend } from '@/lib/team/telegram'
import { saveAgentLearning } from '@/lib/team/agent-store'
import { detectIngestUrl, enqueueIngest } from '@/lib/arsenal/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Webhook MUST return 200 within 30s or Telegram retries. Real
// handoffs (Marek's full pipeline ~2-4 min) run in /api/telegram/dispatch.
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

function dispatchUrl(req: Request): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
  if (fromEnv) return `${fromEnv}/api/telegram/dispatch`
  // Fall back to the request's own host header. This works on
  // Vercel where the function calls itself by hostname.
  const host = req.headers.get('host')
  if (!host) return null
  const proto = host.includes('localhost') ? 'http' : 'https'
  return `${proto}://${host}/api/telegram/dispatch`
}

// Heuristic: short messages starting with "no", "actually", "fix",
// "rule", "👍", "👎", "wrong", "better" are very likely feedback
// on the last turn, not new requests. We tag them as learnings so
// future briefs reflect the operator's correction.
function looksLikeFeedback(
  text: string
): { kind: 'positive' | 'negative' | 'rule'; rule: string } | null {
  const t = text.trim().toLowerCase()
  if (t.length === 0) return null
  if (/^👍|^\+1\b|^nice\b|^great\b|^perfect\b/.test(t)) {
    return { kind: 'positive', rule: text.trim() }
  }
  if (/^👎|^-1\b|^no[, ]|^bad\b|^wrong\b|^awful\b/.test(t)) {
    return { kind: 'negative', rule: text.trim() }
  }
  if (
    /^(rule:|always |never |stop |don'?t |from now on|going forward|fix:|actually,?\s)/i.test(
      text.trim()
    )
  ) {
    return { kind: 'rule', rule: text.trim() }
  }
  return null
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

  if (text === '/start' || text === '/help') {
    await tgSend(chatId, teamIntroText())
    return NextResponse.json({ ok: true })
  }

  const admins = adminChatIds()
  if (admins.size > 0 && !admins.has(String(chatId))) {
    await tgSend(
      chatId,
      `I don't recognise this chat yet — your id is \`${chatId}\`. Ping the admin to add it to the allow-list.`
    )
    return NextResponse.json({ ok: true })
  }

  const clinicId = process.env.TELEGRAM_DEFAULT_CLINIC_ID
  if (!clinicId) {
    await tgSend(
      chatId,
      `_(TELEGRAM_DEFAULT_CLINIC_ID not set — ping admin to wire the clinic id)_`
    )
    return NextResponse.json({ ok: true })
  }

  // Reference-video ingest: doctor drops an IG/YT/TikTok link in chat
  // and Archy (the archivist) queues it for offline extraction by the
  // local Claude Code skill `script-arsenal-ingest`. The skill polls
  // /api/arsenal/queue, runs yt-dlp + audio analysis on Igor's machine
  // (so we don't pay Replicate per video), then POSTs structured hooks
  // + structure + pains back to /api/arsenal/draft. Doctor confirms in
  // TG → row flips is_active=true → Writer sees it in the brief.
  const ingest = detectIngestUrl(text)
  if (ingest) {
    try {
      const { reused, row } = await enqueueIngest({
        clinicId,
        sourceUrl: ingest.url,
        platform: ingest.platform,
        requestedByChatId: String(chatId),
        requestedByName: userName,
      })
      const status = row.status
      let ack: string
      if (reused && status === 'completed') {
        ack =
          '📚 *Archy*\n\nЭта ссылка уже в арсенале. Напиши *"arsenal list"* чтобы увидеть, или *"arsenal off <label>"* чтобы выключить.'
      } else if (reused && status === 'awaiting_confirm') {
        ack =
          '📚 *Archy*\n\nЭта ссылка уже разобрана и ждёт твоего подтверждения. Напиши *"arsenal confirm <label>"* или *"arsenal drop <label>"*.'
      } else if (reused) {
        ack = `📚 *Archy*\n\nЭта ссылка уже в очереди (статус: ${status}). Не дублирую.`
      } else {
        ack = [
          '📚 *Archy*',
          '',
          `Принял ссылку (${ingest.platform}). Поставил в очередь.`,
          '',
          'Локальный скилл подхватит — извлечёт структуру / хуки / боли и пришлёт выжимку. Подтвердишь — стиль попадёт в арсенал Marek\'а.',
        ].join('\n')
      }
      await tgSend(chatId, ack)
    } catch (e) {
      const m = e instanceof Error ? e.message : 'enqueue failed'
      await tgSend(chatId, `📚 *Archy*\n\n_(не смог поставить в очередь: ${m})_`)
    }
    return NextResponse.json({ ok: true })
  }

  await tgChatAction(chatId, 'typing')

  let brief
  try {
    brief = await loadTeamBrief(clinicId)
  } catch (e) {
    const m = e instanceof Error ? e.message : 'brief load failed'
    await tgSend(chatId, `_(brief error: ${m})_`)
    return NextResponse.json({ ok: true })
  }

  let decision
  try {
    decision = await routeAndReply({
      userMessage: text,
      userName,
      botSurface: 'content',
      brief,
    })
  } catch (e) {
    const m = e instanceof Error ? e.message : 'router failed'
    await tgSend(chatId, `_(router error: ${m})_`)
    return NextResponse.json({ ok: true })
  }

  // Capture short-form feedback as agent_learnings so the next brief
  // surfaces the rule. We tag it against the agent the router just
  // picked — when the operator says "no, that hook was generic",
  // the router still picks marek (since marek was last), which is
  // exactly who the rule should apply to.
  const fb = looksLikeFeedback(text)
  if (fb) {
    await saveAgentLearning({
      clinicId,
      agentKey: decision.agent.key,
      userMessage: text,
      feedbackKind: fb.kind,
      rule: fb.kind === 'rule' ? fb.rule : null,
    }).catch(() => {})
  }

  // Send ack first — operator sees the agent's voice immediately
  // even when the real work runs for minutes in dispatch.
  await tgSend(chatId, `${decision.agent.emoji} *${decision.agent.name}*\n\n${decision.ack}`)

  if (decision.intent === 'chat') {
    return NextResponse.json({ ok: true })
  }

  // Fire-and-forget dispatch. Don't await — webhook must return 200
  // fast. The fetch call queues; Node keeps it alive long enough
  // for the request to land in the dispatch handler.
  const url = dispatchUrl(req)
  if (!url) {
    await tgSend(chatId, `_(dispatch URL unavailable)_`)
    return NextResponse.json({ ok: true })
  }
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET ?? ''
  void fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-dispatch-secret': secret,
    },
    body: JSON.stringify({
      clinicId,
      chatId,
      agentKey: decision.agent.key,
      intent: decision.intent,
      params: decision.params,
      userMessage: text,
      userName,
    }),
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    has_token: !!process.env.TELEGRAM_BOT_TOKEN,
    has_clinic: !!process.env.TELEGRAM_DEFAULT_CLINIC_ID,
    admin_count: adminChatIds().size,
    team: TEAM.map((a) => ({
      name: a.name,
      role: a.role,
      tools: a.tools.map((t) => t.id),
    })),
  })
}
