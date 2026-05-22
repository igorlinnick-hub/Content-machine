// Single source of truth for the "LLM agents are off in this build"
// behaviour. Triggered by env var ENABLE_LLM_AGENTS (anything other
// than the literal string 'true' is treated as off — fail-safe default
// so an unset var on a fresh deploy can never accidentally burn API
// credits).
//
// Three callers wire to this:
//   1. lib/agents/base.ts.callAgentJSON — throws LLMAgentsDisabledError
//      before any network call, so every agent (writer, critic, etc.)
//      inherits the gate for free.
//   2. Handoffs (marek, iris, pax, verify) — short-circuit with the
//      friendly TG message instead of calling their agents.
//   3. API routes that wrap agents (/api/agents/*, /api/posts/generate,
//      /api/clips/process, /api/videos/generate) — return a structured
//      503 so any UI button hitting them sees a clean error string.

export class LLMAgentsDisabledError extends Error {
  constructor(message?: string) {
    super(message ?? 'LLM_AGENTS_DISABLED')
    this.name = 'LLMAgentsDisabledError'
  }
}

export function llmAgentsEnabled(): boolean {
  return process.env.ENABLE_LLM_AGENTS === 'true'
}

// The Telegram-friendly message every disabled handoff uses. Single
// source so we can iterate the wording without grepping for it.
export function llmAgentsDisabledTgMessage(featureName: string): string {
  return [
    `_${featureName} is off in this build — running on Claude subscription only._`,
    '',
    'Paste an Instagram / YouTube / TikTok URL or type *arsenal list* to use the arsenal pipeline (subscription-paid, works now).',
    '',
    'To enable post generation: top up Anthropic API credits + set `ENABLE_LLM_AGENTS=true` in Vercel env.',
  ].join('\n')
}

// One-liner used by every API-dependent handoff at the top of its
// run function. Returns true when the caller should bail (handoff
// already sent the TG ack). Returns false when LLM agents are
// enabled and the handoff should run normally.
//
// Usage:
//   if (await guardDisabledHandoff(ctx, 'Post generation')) return
export async function guardDisabledHandoff(
  ctx: {
    chatId: number | string
    agentEmoji: string
    agentName: string
  },
  featureName: string
): Promise<boolean> {
  if (llmAgentsEnabled()) return false
  // Dynamic import avoids pulling the Telegram module into every
  // agent/lib bundle. The cost is one extra await per disabled call,
  // which only matters during cold path — already off the hot trail.
  const { tgSend } = await import('@/lib/team/telegram')
  await tgSend(
    ctx.chatId,
    `${ctx.agentEmoji} *${ctx.agentName}*\n\n${llmAgentsDisabledTgMessage(featureName)}`
  )
  return true
}

// HTTP body used by the route guards. Stable shape so the dashboard
// fetcher can detect "disabled" without parsing prose.
export const LLM_AGENTS_DISABLED_PAYLOAD = {
  ok: false,
  error: 'LLM_AGENTS_DISABLED',
  message:
    'This feature uses the Anthropic API which is off in this build. Set ENABLE_LLM_AGENTS=true and top up credits to enable.',
} as const

export const LLM_AGENTS_DISABLED_STATUS = 503

// Drop-in for API routes that wrap LLM agents. Returns a Response
// with the standard payload when disabled, else null. Callers:
//   const off = disabledHttpResponse(); if (off) return off
// Dynamically importing NextResponse only when we need it lets this
// module stay usable from non-route contexts (handoffs) without
// pulling next runtime types where they don't belong.
export async function disabledHttpResponse(): Promise<Response | null> {
  if (llmAgentsEnabled()) return null
  const { NextResponse } = await import('next/server')
  return NextResponse.json(LLM_AGENTS_DISABLED_PAYLOAD, {
    status: LLM_AGENTS_DISABLED_STATUS,
  })
}
