import type { SharedContext, WriterOutput } from '@/types'
import { MODEL_DEFAULT, callAgentJSON } from './base'

const SYSTEM_PROMPT = `You write scripts for a regenerative medicine doctor speaking to camera.
Tone: smart, non-marketing, peer-to-peer — like explaining to a colleague.

HARD RULES:
- No medical promises ("will cure", "guaranteed", "100%", "always works").
- Only facts with scientific grounding. If you cannot back something, do not write it.
- Voice: confident, educational, alive — not textbook.
- Length: strictly 200-220 words per script (count the words before you finish).
- Structure (in order):
  1. Hook — ~35 words, ~15 seconds. A concrete fact or question, not a generic opening.
  2. Science / fact — ~45 words, ~20 seconds. What the research actually shows.
  3. Clinic approach — ~90 words, ~40 seconds. How we do this differently, grounded in the clinic profile.
  4. Call to action — ~30 words, ~15 seconds. One specific action.

INPUTS YOU WILL USE:
- few_shot_library: style reference, match the voice.
- diff_rules: mandatory — every rule must be followed in the output.
- trend_signals: use for timely topics (do not mention that they are "trending").
- content_memory: recent topics and hooks the clinic has already shipped — do not repeat them.
- raw_insights: mine stories, opinions, angles, and hooks from here. Prefer real clinic material over generic content.

ALWAYS produce exactly 3 distinct variants, each with a different topic OR a different hook angle on the same topic.

Respond with ONLY valid JSON, no markdown fences, no commentary:
{
  "variants": [
    {
      "id": "v1",
      "topic": "...",
      "hook": "...",
      "script": "...",
      "word_count": 210,
      "estimated_seconds": 88
    },
    {
      "id": "v2",
      "topic": "...",
      "hook": "...",
      "script": "...",
      "word_count": 215,
      "estimated_seconds": 90
    },
    {
      "id": "v3",
      "topic": "...",
      "hook": "...",
      "script": "...",
      "word_count": 205,
      "estimated_seconds": 86
    }
  ]
}`

function buildContextBrief(ctx: SharedContext, feedback?: string): string {
  const parts: string[] = []

  const p = ctx.clinic_profile
  parts.push(
    `CLINIC PROFILE:
- Name: ${p.name}
- Services: ${p.services.join(', ') || 'n/a'}
- Audience: ${p.audience || 'n/a'}
- Tone: ${p.tone}
- Doctor: ${p.doctor_name || 'n/a'}
- Medical restrictions: ${p.medical_restrictions.join('; ') || 'none'}`
  )

  const insights = ctx.raw_insights.slice(0, 30)
  if (insights.length) {
    parts.push(
      `RAW INSIGHTS (most recent):\n${insights
        .map((i) => `- [${i.type}] ${i.content}`)
        .join('\n')}`
    )
  }

  const trends = ctx.trend_signals.slice(0, 10)
  if (trends.length) {
    parts.push(
      `TREND SIGNALS:\n${trends
        .map(
          (t) =>
            `- ${t.topic}${t.why_relevant ? ` — ${t.why_relevant}` : ''}${
              t.hook_angle ? ` (hook angle: ${t.hook_angle})` : ''
            }`
        )
        .join('\n')}`
    )
  }

  const recent = ctx.content_memory.slice(0, 10)
  if (recent.length) {
    parts.push(
      `RECENT SCRIPTS — DO NOT REPEAT TOPICS OR HOOKS:\n${recent
        .map((c) => `- topic: ${c.topic ?? 'n/a'} | hook: ${c.hook ?? 'n/a'}`)
        .join('\n')}`
    )
  }

  const examples = ctx.few_shot_library.slice(0, 5)
  if (examples.length) {
    parts.push(
      `FEW-SHOT STYLE EXAMPLES (match this voice):\n${examples
        .map(
          (e, idx) =>
            `--- Example ${idx + 1}${e.topic ? ` (topic: ${e.topic})` : ''} ---\n${e.script_text}${
              e.why_good ? `\n(why it works: ${e.why_good})` : ''
            }`
        )
        .join('\n\n')}`
    )
  }

  if (ctx.diff_rules.length) {
    parts.push(
      `MANDATORY DIFF RULES (priority high → low):\n${ctx.diff_rules
        .map(
          (r) =>
            `- ${r.rule}${r.example_before ? `\n  before: ${r.example_before}` : ''}${
              r.example_after ? `\n  after: ${r.example_after}` : ''
            }`
        )
        .join('\n')}`
    )
  }

  if (feedback && feedback.trim()) {
    parts.push(
      `CRITIC FEEDBACK FROM PREVIOUS ROUND:\n${feedback.trim()}\n\nAddress every point above. Keep variants that were already strong; rewrite the weak ones.`
    )
  }

  return parts.join('\n\n')
}

export interface RunWriterParams {
  context: SharedContext
  feedback?: string
}

export async function runWriter(params: RunWriterParams): Promise<WriterOutput> {
  const brief = buildContextBrief(params.context, params.feedback)
  const userContent = `${brief}\n\nGenerate exactly 3 script variants now. Return only the JSON object.`

  return callAgentJSON<WriterOutput>({
    model: MODEL_DEFAULT,
    systemPrompt: SYSTEM_PROMPT,
    userContent,
    maxTokens: 16384,
    effort: 'low',
  })
}
