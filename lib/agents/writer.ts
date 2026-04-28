import type { SharedContext, WriterOutput } from '@/types'
import { MODEL_DEFAULT, callAgentJSON } from './base'

const SYSTEM_PROMPT = `You write scripts for a regenerative medicine doctor speaking to camera. The audience is curious ADULT PATIENTS — people considering a treatment or trying to understand what's happening with their body. NOT colleagues. NOT other doctors. NOT a peer-reviewed audience.

Voice: a smart, calm doctor explaining things plainly to someone in their chair. Plain English. Short sentences. Concrete everyday comparisons. No medical jargon unless it is immediately unpacked in lay terms (e.g. "your platelets — the part of your blood that helps healing"). Banned phrases: "as a clinician", "in our practice we observe", "the literature suggests", "peer-to-peer", "from a clinical standpoint". Allowed registers: "here's what most people miss", "if you're considering this", "what this means for you", "what to look out for", "why this matters". Do NOT copy-paste a generic "educational / professional / conversational" register. The exact tone is inferred from the FEW-SHOT EXAMPLES and the DOCTOR'S RECENT PICKS.

HARD RULES:
- No medical promises ("will cure", "guaranteed", "100%", "always works").
- Only facts with scientific grounding. If you cannot back something, do not write it.
- Length: strictly 200-220 words per script (count the words before you finish).
- Structure (in order):
  1. Hook — ~35 words, ~15 seconds. A concrete fact or question, not a generic opening.
  2. Science / fact — ~45 words, ~20 seconds. What the research actually shows.
  3. Clinic approach — ~90 words, ~40 seconds. How we do this differently, grounded in the clinic profile.
  4. Call to action — ~30 words, ~15 seconds. One specific action.

INPUTS YOU WILL USE:
- content_pillars: every variant MUST map to one pillar — stay inside the clinic's territory.
- deep_dive_topics: when you pick a topic adjacent to one of these, go deeper and more mechanism-level.
- raw_insights: mine stories, opinions, angles, and hooks from here — especially the clinic's own contrarian opinions. Prefer real clinic material over generic content.
- few_shot_library: style reference, match the voice.
- diff_rules: mandatory — every rule must be followed in the output.
- trend_signals: use for timely topics (do not mention that they are "trending").
- content_memory: topics and hooks already shipped — do NOT repeat them.
- DOCTOR'S RECENT PICKS: the doctor selected these from previous rounds. Their topic/hook/cadence patterns are what works — lean toward them.
- DOCTOR'S RECENT REJECTS: the doctor passed on these. Avoid their topic angles, hook shapes, and framings.

ALWAYS produce exactly 3 distinct variants. Make them genuinely different — different pillars, or the same pillar from different angles. Do not produce minor rewordings of the same idea.

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
- Doctor: ${p.doctor_name || 'n/a'}
- Services: ${p.services.join(', ') || 'n/a'}
- Medical restrictions: ${p.medical_restrictions.join('; ') || 'none'}`
  )

  if (p.content_pillars.length) {
    parts.push(
      `CONTENT PILLARS (every variant must map to one):\n${p.content_pillars
        .map((x) => `- ${x}`)
        .join('\n')}`
    )
  }

  if (p.deep_dive_topics.length) {
    parts.push(
      `DEEP-DIVE TOPICS (go long-form and mechanism-level here):\n${p.deep_dive_topics
        .map((x) => `- ${x}`)
        .join('\n')}`
    )
  }

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

  if (ctx.recent_picks.length) {
    parts.push(
      `DOCTOR'S RECENT PICKS (lean toward these patterns):\n${ctx.recent_picks
        .slice(0, 6)
        .map(
          (f, idx) =>
            `--- Pick ${idx + 1} (topic: ${f.topic ?? 'n/a'}) ---\nhook: ${f.hook ?? 'n/a'}\n${f.full_script}`
        )
        .join('\n\n')}`
    )
  }

  if (ctx.recent_rejects.length) {
    parts.push(
      `DOCTOR'S RECENT REJECTS (avoid these angles / hook shapes):\n${ctx.recent_rejects
        .slice(0, 6)
        .map(
          (f) =>
            `- topic: ${f.topic ?? 'n/a'} | hook: ${f.hook ?? 'n/a'}`
        )
        .join('\n')}`
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
  topicHint?: string
  ctaHint?: string | null
  variantCount?: number
  refineFrom?: {
    topic: string | null
    hook: string | null
    script: string
    note?: string
  }
}

export async function runWriter(params: RunWriterParams): Promise<WriterOutput> {
  const brief = buildContextBrief(params.context, params.feedback)
  const count = Math.max(1, Math.min(3, params.variantCount ?? 3))

  const topicSection = params.topicHint
    ? `\n\nTOPIC FROM THE CONTENT PLAN — write ALL variants on this exact topic. Pick distinct angles or hooks, but the underlying topic is fixed:\n"${params.topicHint.trim()}"\n`
    : ''

  const ctaSection = params.ctaHint
    ? `\n\nCTA TEMPLATE — the call-to-action block (step 4) of every variant must follow this pattern. Replace any {placeholders} with concrete text that fits the script:\n"${params.ctaHint.trim()}"\n`
    : ''

  const refineSection = params.refineFrom
    ? `\n\nPREVIOUS ATTEMPT (refine — do NOT restart from scratch):\ntopic: ${
        params.refineFrom.topic ?? 'n/a'
      }\nhook: ${params.refineFrom.hook ?? 'n/a'}\nscript:\n${params.refineFrom.script.trim()}${
        params.refineFrom.note && params.refineFrom.note.trim().length > 0
          ? `\n\nDOCTOR FEEDBACK ON PREVIOUS ATTEMPT:\n"${params.refineFrom.note.trim()}"`
          : '\n\nThe doctor said the idea is right but the execution is not yet there. Keep the topic and the underlying angle.'
      }\n\nKeep what worked, fix what was weak. Tighten the hook if it was generic. Sharpen the science block. Make the clinic-approach block more concrete. Same length budget (200-220 words).`
    : ''

  const userContent = `${brief}${topicSection}${ctaSection}${refineSection}\n\nGenerate exactly ${count} script variant${count === 1 ? '' : 's'} now. Return only the JSON object.`

  return callAgentJSON<WriterOutput>({
    model: MODEL_DEFAULT,
    systemPrompt: SYSTEM_PROMPT,
    userContent,
    maxTokens: 16384,
    effort: 'low',
  })
}
