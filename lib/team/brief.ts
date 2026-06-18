import { loadClinicProfile } from '@/lib/supabase/context'
import { loadCategories, type Category } from '@/lib/posts/categories'
import { loadPlan, type PlanTopic } from '@/lib/posts/plan'
import { createServerClient } from '@/lib/supabase/server'
import { loadArsenal, type ArsenalRow } from '@/lib/arsenal/store'
import {
  loadAgentLearnings,
  loadAgentPreferences,
  loadAgentPrompts,
  type AgentLearningRow,
} from './agent-store'
import { TEAM, type AgentPersona } from './personas'
import type {
  ClinicProfile,
  ScriptFeedbackEntry,
  DiffRule,
  FeedbackAction,
} from '@/types'

// What the team knows when a Telegram message arrives. Loaded once
// per turn, passed into the router as cacheable system content. The
// shape stays stable so prompt-cache hits across calls within a 5-min
// window — see lib/agents/base.ts cacheSystem flag.

export interface LatestSlideSet {
  id: string
  status: string
  topic: string | null
  hook: string | null
  created_at: string
}

export interface AgentBriefSlice {
  // The persona row from code (name, role, personality, tools).
  persona: AgentPersona
  // DB override of the system prompt fragment (most recent active).
  // Empty string when no override is set yet — the router falls back
  // to the persona personality string.
  prompt_override: string
  // Free-form prefs the agent may consult.
  prefs: Record<string, unknown>
  // Recent durable rules / corrections this agent has learned. Loaded
  // most-recent first, capped to keep the brief tight.
  learnings: AgentLearningRow[]
}

export interface TeamBrief {
  clinic: ClinicProfile
  categories: Category[]
  recent_picks: ScriptFeedbackEntry[]
  diff_rules: DiffRule[]
  latest_slide_set: LatestSlideSet | null
  pending_plan_topics: PlanTopic[]
  // Active script_arsenal entries (is_active=true). Each row is a
  // distinct, doctor-curated style ingested from an external video —
  // Writer reads these as style references, not as templates to copy.
  arsenal: ArsenalRow[]
  // Per-agent slice keyed by persona.key.
  agents: Record<string, AgentBriefSlice>
  // The clinic uuid — handy for handoffs that need to call into
  // the post / video pipeline.
  clinic_id: string
}

interface RecentPickRow {
  id: string
  action: string
  created_at: string | null
  script_id: string
  scripts:
    | { topic: string | null; hook: string | null; full_script: string }
    | Array<{ topic: string | null; hook: string | null; full_script: string }>
    | null
}

async function loadRecentPicks(clinicId: string, limit = 5) {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('script_feedback')
    .select(
      'id, action, created_at, script_id, scripts ( topic, hook, full_script )'
    )
    .eq('clinic_id', clinicId)
    .eq('action', 'selected')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  const nowIso = new Date().toISOString()
  return (data as RecentPickRow[] | null ?? []).map((r) => {
    const s = Array.isArray(r.scripts) ? r.scripts[0] : r.scripts
    const entry: ScriptFeedbackEntry = {
      id: r.id,
      script_id: r.script_id,
      action: r.action as FeedbackAction,
      topic: s?.topic ?? null,
      hook: s?.hook ?? null,
      full_script: s?.full_script ?? '',
      created_at: r.created_at ?? nowIso,
    }
    return entry
  })
}

async function loadDiffRules(clinicId: string): Promise<DiffRule[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('diff_rules')
    .select('id, rule, example_before, example_after, priority')
    .eq('clinic_id', clinicId)
    .eq('active', true)
    .order('priority', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    rule: r.rule,
    example_before: r.example_before,
    example_after: r.example_after,
    priority: r.priority ?? 3,
  }))
}

async function loadLatestSlideSet(
  clinicId: string
): Promise<LatestSlideSet | null> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('slide_sets')
    .select('id, status, created_at, scripts ( topic, hook )')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  const s = Array.isArray(data.scripts) ? data.scripts[0] : data.scripts
  const script = (s ?? null) as { topic: string | null; hook: string | null } | null
  return {
    id: data.id,
    status: (data.status as string | null) ?? 'rendered',
    topic: script?.topic ?? null,
    hook: script?.hook ?? null,
    created_at: data.created_at ?? new Date().toISOString(),
  }
}

export async function loadTeamBrief(clinicId: string): Promise<TeamBrief> {
  const [
    clinic,
    categories,
    recentPicks,
    diffRules,
    latestSlideSet,
    plan,
    promptRows,
    prefRows,
    learningRows,
    arsenal,
  ] = await Promise.all([
    loadClinicProfile(clinicId),
    loadCategories(clinicId),
    loadRecentPicks(clinicId, 5),
    loadDiffRules(clinicId),
    loadLatestSlideSet(clinicId),
    loadPlan(clinicId),
    loadAgentPrompts(clinicId),
    loadAgentPreferences(clinicId),
    loadAgentLearnings(clinicId, 8),
    loadArsenal(clinicId, { onlyActive: true, limit: 6 }),
  ])

  const promptByAgent = new Map(promptRows.map((r) => [r.agent_key, r.system_prompt]))
  const prefsByAgent = new Map(prefRows.map((r) => [r.agent_key, r.prefs]))
  const learningsByAgent = new Map<string, AgentLearningRow[]>()
  for (const l of learningRows) {
    const list = learningsByAgent.get(l.agent_key) ?? []
    list.push(l)
    learningsByAgent.set(l.agent_key, list)
  }

  const agents: Record<string, AgentBriefSlice> = {}
  for (const persona of TEAM) {
    agents[persona.key] = {
      persona,
      prompt_override: promptByAgent.get(persona.key) ?? '',
      prefs: prefsByAgent.get(persona.key) ?? {},
      learnings: learningsByAgent.get(persona.key) ?? [],
    }
  }

  const pending_plan_topics = plan
    .filter((t) => t.status === 'pending')
    .slice(0, 5)

  return {
    clinic,
    categories,
    recent_picks: recentPicks,
    diff_rules: diffRules,
    latest_slide_set: latestSlideSet,
    pending_plan_topics,
    arsenal,
    agents,
    clinic_id: clinicId,
  }
}

// Render the brief as a single string the router system-prompt can
// concatenate with cache_control:ephemeral. Keep the output stable
// (no timestamps drifting) so the cache hits on consecutive turns.
export function formatBriefForRouter(brief: TeamBrief): string {
  const lines: string[] = []

  lines.push(`# Clinic`)
  lines.push(`Name: ${brief.clinic.name}`)
  if (brief.clinic.doctor_name) lines.push(`Doctor: ${brief.clinic.doctor_name}`)
  if (brief.clinic.audience) lines.push(`Audience: ${brief.clinic.audience}`)
  lines.push(`Tone: ${brief.clinic.tone}`)
  if (brief.clinic.services?.length)
    lines.push(`Services: ${brief.clinic.services.join(', ')}`)
  if (brief.clinic.content_pillars?.length)
    lines.push(`Pillars: ${brief.clinic.content_pillars.join(', ')}`)
  if (brief.clinic.medical_restrictions?.length)
    lines.push(`Medical restrictions: ${brief.clinic.medical_restrictions.join('; ')}`)
  lines.push('')

  if (brief.categories.length) {
    lines.push(`# Content categories (with linked Drive folders for photos)`)
    for (const c of brief.categories) {
      const folder = c.drive_folder_id ? `drive=${c.drive_folder_id}` : 'no drive folder'
      lines.push(`- ${c.emoji ?? '•'} ${c.name} (${c.slug}) — ${folder}`)
    }
    lines.push('')
  }

  if (brief.diff_rules.length) {
    lines.push(`# Operator-imposed writing rules (must follow)`)
    for (const r of brief.diff_rules.slice(0, 8)) {
      lines.push(`- ${r.rule}`)
    }
    lines.push('')
  }

  if (brief.recent_picks.length) {
    lines.push(`# Recent operator-picked posts (voice / topic reference)`)
    for (const p of brief.recent_picks) {
      lines.push(`- "${p.topic ?? 'untitled'}" — hook: "${p.hook ?? ''}"`)
    }
    lines.push('')
  }

  if (brief.arsenal.length) {
    lines.push(
      `# Script arsenal (doctor-curated reference styles — borrow STRUCTURE / HOOK PATTERNS, do NOT copy text)`
    )
    lines.push(
      `Each style is independent. Pick ONE style per post — never mix two arsenal styles in the same script.`
    )
    lines.push('')
    for (const a of brief.arsenal) {
      lines.push(`## Style: ${a.style_label}`)
      if (a.style_description) lines.push(a.style_description)
      const hooks = Array.isArray(a.hooks) ? a.hooks : []
      if (hooks.length) {
        lines.push(`Hook patterns:`)
        for (const h of hooks.slice(0, 4)) {
          lines.push(`- "${h.text}"`)
        }
      }
      const beats = a.structure?.beats ?? []
      if (beats.length) {
        lines.push(`Beat sequence:`)
        for (const b of beats) {
          lines.push(`- ${b.name}: ${b.text}`)
        }
      }
      if (a.structure?.notes) {
        lines.push(`Notes: ${a.structure.notes}`)
      }
      const pains = Array.isArray(a.pains) ? a.pains : []
      if (pains.length) {
        lines.push(`Patient pains mentioned: ${pains.slice(0, 5).join(' · ')}`)
      }
      if (a.tags.length) lines.push(`Tags: ${a.tags.join(', ')}`)
      lines.push('')
    }
  }

  lines.push(`# Current state`)
  if (brief.latest_slide_set) {
    lines.push(
      `Latest slide_set: ${brief.latest_slide_set.id} (${brief.latest_slide_set.status}) — "${brief.latest_slide_set.topic ?? 'untitled'}"`
    )
  } else {
    lines.push(`Latest slide_set: none yet`)
  }
  if (brief.pending_plan_topics.length) {
    lines.push(`Pending plan topics:`)
    for (const t of brief.pending_plan_topics) {
      lines.push(`- ${t.topic}`)
    }
  } else {
    lines.push(`Plan: empty`)
  }
  lines.push('')

  lines.push(`# Per-agent overrides + learnings`)
  for (const persona of TEAM) {
    const slice = brief.agents[persona.key]
    if (!slice) continue
    const hasOverride = slice.prompt_override.trim().length > 0
    const hasPrefs = Object.keys(slice.prefs).length > 0
    const hasLearnings = slice.learnings.length > 0
    if (!hasOverride && !hasPrefs && !hasLearnings) continue
    lines.push(`## ${persona.emoji} ${persona.name}`)
    if (hasOverride) {
      lines.push(`Prompt override:`)
      lines.push(slice.prompt_override.trim())
    }
    if (hasPrefs) {
      lines.push(`Preferences: ${JSON.stringify(slice.prefs)}`)
    }
    if (hasLearnings) {
      lines.push(`Recent learnings (most recent first):`)
      for (const l of slice.learnings) {
        const tag =
          l.feedback_kind === 'rule'
            ? 'RULE'
            : l.feedback_kind === 'correction'
              ? 'FIX'
              : l.feedback_kind === 'positive'
                ? '+'
                : '-'
        const body = l.rule ?? l.user_message
        lines.push(`- [${tag}] ${body}`)
      }
    }
    lines.push('')
  }

  return lines.join('\n').trim()
}
