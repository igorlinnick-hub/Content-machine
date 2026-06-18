// Single source of truth for the "LLM agents are off in this build"
// behaviour. Triggered by env var ENABLE_LLM_AGENTS (anything other
// than the literal string 'true' is treated as off — fail-safe default
// so an unset var on a fresh deploy can never accidentally burn API
// credits).

export class LLMAgentsDisabledError extends Error {
  constructor(message?: string) {
    super(message ?? 'LLM_AGENTS_DISABLED')
    this.name = 'LLMAgentsDisabledError'
  }
}

export function llmAgentsEnabled(): boolean {
  return process.env.ENABLE_LLM_AGENTS === 'true'
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
