import type { ClinicProfile, ResearchOutput, TrendSignal } from '@/types'
import { MODEL_DEFAULT, WEB_SEARCH_TOOL, callAgentJSON } from './base'
import { saveTrendSignals } from '@/lib/supabase/context'

const SYSTEM_PROMPT = `You are a content-trends researcher for a regenerative medicine clinic.
Use web_search to find what is being discussed right now in the longevity and regenerative medicine space. Focus on:
- new peer-reviewed studies in the last 6-12 months
- topics gaining traction among clinicians and longevity creators
- scientific facts that can be explained simply in a 90-second video

You are NOT writing scripts. Your job is to surface timely topics, hook angles, and things to avoid.

Rules:
- No fluff. Every topic must be specific enough that a clinic could make a video about it.
- Cite what makes it relevant — a study, a trend, or a frequent patient question.
- Do not include topics that contradict the clinic's declared medical restrictions.

After you are done searching, respond with ONLY valid JSON — no markdown fences, no commentary:
{
  "trending_topics": [
    {"topic": "...", "why_relevant": "...", "hook_angle": "..."}
  ],
  "working_hooks": ["..."],
  "avoid_topics": ["..."]
}`

export interface RunResearchParams {
  clinicId: string
  clinic: ClinicProfile
  persist?: boolean
  expiresInDays?: number
}

export interface RunResearchResult {
  output: ResearchOutput
  signals: TrendSignal[]
}

export async function runResearch(params: RunResearchParams): Promise<RunResearchResult> {
  const { clinic } = params
  const brief = `Clinic niche: ${clinic.niche}
Services offered: ${clinic.services.join(', ') || 'n/a'}
Audience: ${clinic.audience || 'n/a'}
Medical restrictions (never contradict these): ${
    clinic.medical_restrictions.join('; ') || 'none specified'
  }

Do research now. Return only the JSON.`

  const output = await callAgentJSON<ResearchOutput>({
    model: MODEL_DEFAULT,
    systemPrompt: SYSTEM_PROMPT,
    userContent: brief,
    maxTokens: 8192,
    tools: [WEB_SEARCH_TOOL],
  })

  const persist = params.persist ?? true
  if (!persist) return { output, signals: [] }

  const rows = (output.trending_topics ?? []).map((t) => ({
    topic: t.topic,
    why_relevant: t.why_relevant,
    hook_angle: t.hook_angle,
    expires_in_days: params.expiresInDays ?? 14,
  }))

  const signals = await saveTrendSignals(params.clinicId, rows)
  return { output, signals }
}
