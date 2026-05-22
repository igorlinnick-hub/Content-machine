import { TEAM, type AgentPersona } from './personas'
import type { RouterDecision } from './router-agent'

// Zero-cost router used when ENABLE_LLM_AGENTS=false. Replicates the
// shape of `routeAndReply()` so the webhook only has to swap one call
// site. Handles ONLY the subscription-paid flows:
//
//   1. /start, /help          → intro from TEAM
//   2. URL detect              → handled UPSTREAM in webhook (this
//                                router never sees URL-bearing text)
//   3. "arsenal <command>"     → Archy intents (list / confirm /
//                                on / off / drop)
//   4. anything else           → friendly fallback explaining the
//                                build is arsenal-only
//
// No LLM. No external calls. Pure string matching.

function persona(key: string): AgentPersona {
  return TEAM.find((a) => a.key === key) ?? TEAM[0]
}

const ARSENAL_CMD_RE =
  /^\s*arsenal\s+(list|confirm|on|off|drop|toggle)(?:\s+(.+))?\s*$/i

function ackForArsenalIntent(
  intent: 'arsenal_list' | 'arsenal_confirm' | 'arsenal_toggle' | 'arsenal_drop',
  label?: string
): string {
  switch (intent) {
    case 'arsenal_list':
      return '📚 *Archy*\n\nLoading the arsenal…'
    case 'arsenal_confirm':
      return `📚 *Archy*\n\nConfirming \`${label}\`…`
    case 'arsenal_toggle':
      return `📚 *Archy*\n\nFlipping \`${label}\`…`
    case 'arsenal_drop':
      return `📚 *Archy*\n\nDropping \`${label}\`…`
  }
}

const FALLBACK_REPLY = [
  '_(LLM agents off in this build — running on Claude subscription only)_',
  '',
  'What I can do right now:',
  '• Paste an Instagram / YouTube / TikTok URL → arsenal ingest',
  '• `arsenal list` — see the library',
  '• `arsenal confirm <label>` — activate a draft (also auto-adds it to Templates)',
  '• `arsenal on <label>` / `arsenal off <label>` / `arsenal drop <label>`',
  '',
  'Post generation, research, video gen, and chat with the rest of the team are off until ENABLE_LLM_AGENTS=true + Anthropic credits.',
].join('\n')

export function routeRegex(userMessage: string): RouterDecision {
  const text = userMessage.trim()

  // arsenal commands
  const m = text.match(ARSENAL_CMD_RE)
  if (m) {
    const verb = m[1].toLowerCase() as
      | 'list'
      | 'confirm'
      | 'on'
      | 'off'
      | 'drop'
      | 'toggle'
    const label = (m[2] ?? '').trim()
    const archy = persona('archy')
    if (verb === 'list') {
      return {
        agent: archy,
        intent: 'arsenal_list',
        params: {},
        ack: ackForArsenalIntent('arsenal_list'),
      }
    }
    if (verb === 'confirm') {
      return {
        agent: archy,
        intent: 'arsenal_confirm',
        params: { label },
        ack: ackForArsenalIntent('arsenal_confirm', label),
      }
    }
    if (verb === 'on' || verb === 'off' || verb === 'toggle') {
      // 'toggle' without explicit active value defaults to flip-on for
      // safety (matches Archy handoff's default).
      const active = verb === 'off' ? false : true
      return {
        agent: archy,
        intent: 'arsenal_toggle',
        params: { label, active },
        ack: ackForArsenalIntent('arsenal_toggle', label),
      }
    }
    if (verb === 'drop') {
      return {
        agent: archy,
        intent: 'arsenal_drop',
        params: { label },
        ack: ackForArsenalIntent('arsenal_drop', label),
      }
    }
  }

  // Anything else → chat fallback. The webhook treats intent='chat' as
  // ack-only (no dispatch), so the fallback message is the whole
  // response.
  return {
    agent: persona('archy'),
    intent: 'chat',
    params: {},
    ack: FALLBACK_REPLY,
  }
}
