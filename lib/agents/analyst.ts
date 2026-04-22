import type { AnalystOutput, Insight, InsightType } from '@/types'
import { MODEL_DEFAULT, callAgentJSON } from './base'
import { saveInsights } from '@/lib/supabase/context'

const SYSTEM_PROMPT = `You are a content analyst for a regenerative medicine clinic.
You receive raw doctor's notes (either typed or voice-transcribed). Extract:
- stories: concrete observations, patient cases, or specific clinical moments
- opinions: the doctor's point of view on a topic (how strongly they feel, 1-5)
- angles: interesting content angles worth exploring in future videos
- hooks: candidate video hooks (short, specific, curiosity-driven)

Rules:
- Do not invent content that is not in the notes.
- Do not mix categories — a story is a concrete event, an opinion is a stance.
- If the notes are empty or contain nothing useful, return arrays with zero items.
- Be concise — each item is one or two sentences.

Respond with ONLY valid JSON, no markdown fences, no commentary:
{
  "stories": [{"text": "...", "topic": "..."}],
  "opinions": [{"text": "...", "strength": 1}],
  "angles": ["..."],
  "hooks": ["..."]
}`

export interface RunAnalystParams {
  clinicId: string
  rawText: string
  persist?: boolean
}

export interface RunAnalystResult {
  output: AnalystOutput
  insights: Insight[]
}

export async function runAnalyst(params: RunAnalystParams): Promise<RunAnalystResult> {
  const output = await callAgentJSON<AnalystOutput>({
    model: MODEL_DEFAULT,
    systemPrompt: SYSTEM_PROMPT,
    userContent: `Doctor's raw notes:\n\n${params.rawText}`,
    maxTokens: 4096,
  })

  const persist = params.persist ?? true
  if (!persist) return { output, insights: [] }

  const rows: Array<{ type: InsightType; content: string }> = []
  for (const s of output.stories ?? []) rows.push({ type: 'story', content: s.text })
  for (const o of output.opinions ?? []) rows.push({ type: 'opinion', content: o.text })
  for (const a of output.angles ?? []) rows.push({ type: 'angle', content: a })
  for (const h of output.hooks ?? []) rows.push({ type: 'hook', content: h })

  const insights = await saveInsights(params.clinicId, rows)
  return { output, insights }
}
