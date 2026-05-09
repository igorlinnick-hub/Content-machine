import { MODEL_HAIKU, callAgentJSON } from '@/lib/agents/base'
import { TEAM, type AgentPersona } from './personas'
import { formatBriefForRouter, type TeamBrief } from './brief'

// Conversational LLM router v1. Reads the user's free-form message,
// picks the team member best fit to respond, drafts an ack reply in
// that member's voice, and — when the request maps to a real tool —
// emits a structured intent that the webhook dispatcher can act on.
//
// v0 returned only {agent_key, reply}. v1 adds {intent, params,
// ack_text} so the dispatcher can spawn real handoffs (Marek →
// generate_post, Ops → diag, etc) instead of just chatting back.
//
// The brief (clinic profile, categories, recent picks, diff_rules,
// per-agent learnings) is included as cacheable system content so
// agents actually know the project — not just their persona.

const BASE_PROMPT = `You are the orchestration layer for a small AI team that talks to its operator (a clinic admin) via Telegram.

The team and their tools:

${TEAM.map((a) => {
  const tools = a.tools
    .map(
      (t) =>
        `    - ${t.id}${t.enabled ? '' : ' (DISABLED)'} — ${t.description}`
    )
    .join('\n')
  return `- ${a.emoji} ${a.name} (${a.key}) — ${a.role}.
  Personality: ${a.personality}
  Tools:
${tools}`
}).join('\n')}

The user writes free-form messages. They do NOT use slash commands. They might:
- address an agent by name ("Marek, draft a post on TMS")
- describe a task without naming anyone ("I need a video about ketamine")
- ask the whole team a question ("how much did we spend last week?")
- chat casually ("hey, what should we make today?")
- give feedback on a previous handoff ("that hook was too generic, fix it")

Your job, given ONE incoming user message:

1. Pick exactly ONE team member who should respond. Match by who owns that domain. Default to the closest match — never refuse.
2. Decide if this maps to one of that member's tools. If yes, set "intent" to the tool id and fill "params" accordingly. If the message is conversational (greeting, question, planning out loud) or the matching tool is DISABLED, set "intent" to "chat".
3. Draft an "ack_text" — what the agent says BEFORE the tool actually runs. This is what the operator sees first. Must:
   - feel like a person on the team, not a chatbot
   - be 1-3 sentences
   - acknowledge what's happening ("on it, drafting the post now" / "running diag now" / for chat: just answer)
   - never promise something a DISABLED tool offers — say it's paused and why if asked
   - never use markdown headings or slash-commands; light *bold* and _italic_ allowed (Telegram-flavoured)

4. If the message asks the wrong bot (e.g. ad spend on the content bot), set intent="chat" and point at the right bot.

This is the CONTENT bot. It owns posts / carousels / short-form video / research / status. Ads / leads / CRM belong to the OPS bot (@hawaiiwellnessclinicbot).

Tool param schemas (only fill if intent matches; otherwise return {} ):

- generate_post: { "topic": string, "length": "short"|"long", "note"?: string }
- refine_post: { "slide_set_id"?: string, "note": string }   // 'refine_script' is an alias
- verify_post: { "slide_set_id"?: string }
- re_render_slides: { "slide_set_id"?: string }
- verify_render: { "slide_set_id"?: string }
- change_style: { "tweak": string }   // free-form description, applied later
- web_research: { "query": string, "max_sources"?: number }
- billing_report: { "period"?: "today"|"week"|"month" }
- diag: {}
- daily_check: {}
- clip_clean: {}
- clip_status: {}
- verify_clip: {}

If params are ambiguous (e.g. "make a post" with no topic), set intent="chat" and ask ONE clarifying question in ack_text instead of guessing the topic.

Respond with ONLY valid JSON, no markdown fences:
{
  "agent_key": "marek|tilda|ren|iris|vex|ops",
  "intent": "<tool_id|chat>",
  "params": { ... },
  "ack_text": "..."
}`

export interface RouteAndReplyInput {
  userMessage: string
  userName?: string
  botSurface?: 'content' | 'ops'
  brief: TeamBrief
}

export interface RouterDecision {
  agent: AgentPersona
  intent: string
  params: Record<string, unknown>
  ack: string
}

interface RouterRawOutput {
  agent_key: string
  intent: string
  params?: Record<string, unknown>
  ack_text?: string
  reply?: string
}

export async function routeAndReply(
  input: RouteAndReplyInput
): Promise<RouterDecision> {
  // System prompt = base instructions + project brief, joined and
  // cached together. The brief IS stable enough across consecutive
  // turns within 5 minutes that the cache hits — clinic profile and
  // category list change rarely.
  const systemPrompt = `${BASE_PROMPT}\n\n---\n\n${formatBriefForRouter(input.brief)}`

  const out = await callAgentJSON<RouterRawOutput>({
    model: MODEL_HAIKU,
    systemPrompt,
    userContent: `Bot surface: ${input.botSurface ?? 'content'}
User${input.userName ? ` (${input.userName})` : ''} says:

${input.userMessage}

Pick the agent, set the intent, draft the ack.`,
    maxTokens: 1024,
    cacheSystem: true,
  })

  const fallback = TEAM[0]
  const agent =
    TEAM.find((a) => a.key === (out.agent_key ?? '').toLowerCase()) ?? fallback

  // Validate intent against the agent's tools. If the LLM hallucinates
  // a tool the agent doesn't own (or one that's disabled), downgrade
  // to "chat" so the dispatcher doesn't try to run it.
  const toolMap = new Map(agent.tools.map((t) => [t.id, t]))
  const requestedIntent = (out.intent ?? 'chat').toLowerCase()
  const tool = toolMap.get(requestedIntent)
  const intent =
    requestedIntent === 'chat' || (tool && tool.enabled)
      ? requestedIntent
      : 'chat'

  const ack =
    (out.ack_text ?? out.reply ?? '').trim() ||
    `${agent.emoji} ${agent.name} on it.`

  return {
    agent,
    intent,
    params: out.params ?? {},
    ack,
  }
}
