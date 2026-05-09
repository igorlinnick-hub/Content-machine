import { tgSend } from '../telegram'

// Vex's billing handoff — v0. We don't have programmatic access to
// the Anthropic / Replicate / Vercel billing APIs yet. The honest
// answer is: dashboards live at the URLs below, and Vex flags which
// keys are configured so the operator knows what's actually billing.
// When real billing readers land, this function gains the real
// numbers without changing the handoff plumbing.

export interface VexBillingParams {
  period?: 'today' | 'week' | 'month'
}

export interface VexHandoffContext {
  chatId: number | string
  agentEmoji: string
  agentName: string
}

export async function runVexBilling(
  params: VexBillingParams,
  ctx: VexHandoffContext
): Promise<void> {
  const period = params.period ?? 'month'
  const services = [
    {
      name: 'Anthropic',
      enabled: !!process.env.ANTHROPIC_API_KEY,
      dashboard: 'https://console.anthropic.com/usage',
    },
    {
      name: 'Replicate',
      enabled: !!process.env.REPLICATE_API_TOKEN,
      dashboard: 'https://replicate.com/account/billing',
    },
    {
      name: 'Vercel',
      enabled: true,
      dashboard: 'https://vercel.com/account/billing',
    },
    {
      name: 'OpenAI (Whisper)',
      enabled: !!process.env.OPENAI_API_KEY,
      dashboard: 'https://platform.openai.com/usage',
    },
  ]

  const lines = services.map(
    (s) =>
      `${s.enabled ? '🟢' : '⚪'} *${s.name}* — ${s.enabled ? 'billing key live' : 'not configured'}\n  ${s.dashboard}`
  )

  const text = [
    `${ctx.agentEmoji} *${ctx.agentName}* — billing (${period})`,
    ``,
    'I don\'t have programmatic readers on these yet — flagging which keys are live so you know what\'s actually charging your card. Hit the dashboards directly for numbers:',
    ``,
    ...lines,
    ``,
    '_When you want me to start logging actual run-rate, ask Claude Code to wire the Anthropic Usage API + Replicate billing endpoint._',
  ].join('\n')

  await tgSend(ctx.chatId, text, { disablePreview: true })
}
