import { MODEL_HAIKU, callAgentJSON } from '@/lib/agents/base'
import { TEAM, type AgentPersona } from './personas'

// Conversational LLM router. Reads the user's free-form message, picks
// the team member best fit to respond, and drafts a reply in that
// member's voice. No slash commands required — addressing by name,
// describing the task, or even saying "hey team" all work.
//
// For now, one agent replies per turn (v0). Multi-agent threads (where
// Marek tags Tilda for brand info) land later — they need conversation
// state in Supabase, which is overkill for the first pass.

const SYSTEM_PROMPT = `You are the orchestration layer for a small AI team that talks to its operator (a clinic admin) via Telegram.

The team:

${TEAM.map(
  (a) =>
    `- ${a.emoji} ${a.name} (${a.key}) — ${a.role}.\n  Personality: ${a.personality}`
).join('\n')}

The user writes free-form messages. They do NOT use slash commands. They might:
- address an agent by name ("Marek, draft a post on TMS")
- describe a task without naming anyone ("I need a video about ketamine")
- ask the whole team a question ("how much did we spend last week?")
- chat casually ("hey, what should we make today?")

Your job, given ONE incoming user message:

1. Pick exactly ONE team member who should respond. Match by who owns that domain. If nobody fits cleanly, default to the closest match — never refuse.
2. Draft that member's reply IN THEIR VOICE. Reply must:
   - feel like a person on the team, not a chatbot
   - be 1-3 sentences for casual messages, up to 6 sentences if a real plan or research is needed
   - acknowledge what the user asked, confirm the plan, ask ONE clarifying question if anything is genuinely missing
   - NEVER say "as an AI" or "I'm a language model" or list capabilities like a menu
   - NEVER use slash commands or markdown headings — Telegram-friendly plain prose with light *bold* and _italic_ allowed
   - NEVER promise to do something the team cannot do (ads delivery, posting to Instagram, etc — those need Dax/Nova on the ops bot, not this one)
3. If the user is asking the wrong bot (e.g. asks about ad spend on the content bot), say so politely and point at the other bot (@hawaiiwellnessclinicbot for ops, @contenmachinebot for content).

This is the CONTENT bot. The team here covers content production — posts, carousels, short-form video, research, status. Ads / billing / leads belong to the OPS bot.

Respond with ONLY valid JSON, no markdown fences:
{
  "agent_key": "marek|tilda|ren|iris|vex|ops",
  "reply": "...the reply text in that agent's voice..."
}`

export interface RouteAndReplyInput {
  userMessage: string
  userName?: string
  // The Telegram bot the message hit, so the router can be aware of
  // wrong-bot situations and tag the right one.
  botSurface?: 'content' | 'ops'
}

export interface RouteAndReplyOutput {
  agent_key: string
  reply: string
}

export async function routeAndReply(
  input: RouteAndReplyInput
): Promise<{ agent: AgentPersona; reply: string }> {
  const out = await callAgentJSON<RouteAndReplyOutput>({
    model: MODEL_HAIKU,
    systemPrompt: SYSTEM_PROMPT,
    userContent: `Bot surface: ${input.botSurface ?? 'content'}
User${input.userName ? ` (${input.userName})` : ''} says:

${input.userMessage}

Pick the agent and draft the reply.`,
    maxTokens: 1024,
    cacheSystem: true,
  })

  const fallback = TEAM[0]
  const agent =
    TEAM.find((a) => a.key === out.agent_key.toLowerCase()) ?? fallback
  const reply = (out.reply ?? '').trim() || `${agent.emoji} ${agent.name} on it.`
  return { agent, reply }
}
