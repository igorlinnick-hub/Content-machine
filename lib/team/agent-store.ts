import { createServerClient } from '@/lib/supabase/server'
import type { Json } from '@/types/supabase'

// Per-clinic, per-agent self-evolution layer. Migration 011.
// The Telegram team router loads these alongside SharedContext on
// every turn so agents pick up new rules / prefs without code edits.

export interface AgentPromptRow {
  agent_key: string
  system_prompt: string
  version: number
}

export interface AgentPreferencesRow {
  agent_key: string
  prefs: Record<string, unknown>
}

export type AgentLearningKind = 'positive' | 'negative' | 'correction' | 'rule'

export interface AgentLearningRow {
  id: string
  agent_key: string
  user_message: string
  agent_action: string | null
  feedback_kind: AgentLearningKind
  rule: string | null
  created_at: string
}

export async function loadAgentPrompts(
  clinicId: string
): Promise<AgentPromptRow[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('agent_prompts')
    .select('agent_key, system_prompt, version')
    .eq('clinic_id', clinicId)
    .eq('active', true)
  if (error) throw error
  return (data ?? []) as AgentPromptRow[]
}

export async function loadAgentPreferences(
  clinicId: string
): Promise<AgentPreferencesRow[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('agent_preferences')
    .select('agent_key, prefs')
    .eq('clinic_id', clinicId)
  if (error) throw error
  return ((data ?? []) as Array<{
    agent_key: string
    prefs: unknown
  }>).map((r) => ({
    agent_key: r.agent_key,
    prefs: (r.prefs ?? {}) as Record<string, unknown>,
  }))
}

export async function loadAgentLearnings(
  clinicId: string,
  perAgentLimit = 8
): Promise<AgentLearningRow[]> {
  // Pull a generous window then trim per-agent so a chatty agent
  // doesn't crowd the others out of the brief.
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('agent_learnings')
    .select(
      'id, agent_key, user_message, agent_action, feedback_kind, rule, created_at'
    )
    .eq('clinic_id', clinicId)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(perAgentLimit * 8)
  if (error) throw error
  const byAgent = new Map<string, AgentLearningRow[]>()
  for (const r of (data ?? []) as AgentLearningRow[]) {
    const list = byAgent.get(r.agent_key) ?? []
    if (list.length < perAgentLimit) list.push(r)
    byAgent.set(r.agent_key, list)
  }
  return Array.from(byAgent.values()).flat()
}

export async function saveAgentLearning(params: {
  clinicId: string
  agentKey: string
  userMessage: string
  agentAction?: string | null
  feedbackKind: AgentLearningKind
  rule?: string | null
}): Promise<{ id: string }> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('agent_learnings')
    .insert({
      clinic_id: params.clinicId,
      agent_key: params.agentKey,
      user_message: params.userMessage,
      agent_action: params.agentAction ?? null,
      feedback_kind: params.feedbackKind,
      rule: params.rule ?? null,
    })
    .select('id')
    .single()
  if (error || !data)
    throw error ?? new Error('saveAgentLearning: insert returned no row')
  return { id: data.id }
}

export async function upsertAgentPrompt(params: {
  clinicId: string
  agentKey: string
  systemPrompt: string
}): Promise<void> {
  const supabase = createServerClient()
  // Deactivate previous active row, then insert a new one. Keeps
  // a versioned trail so we can roll back.
  const { data: existing } = await supabase
    .from('agent_prompts')
    .select('id, version')
    .eq('clinic_id', params.clinicId)
    .eq('agent_key', params.agentKey)
    .eq('active', true)
    .maybeSingle()

  const nextVersion = (existing?.version ?? 0) + 1

  if (existing) {
    const { error } = await supabase
      .from('agent_prompts')
      .update({ active: false })
      .eq('id', existing.id)
    if (error) throw error
  }

  const { error: insertError } = await supabase.from('agent_prompts').insert({
    clinic_id: params.clinicId,
    agent_key: params.agentKey,
    system_prompt: params.systemPrompt,
    version: nextVersion,
    active: true,
  })
  if (insertError) throw insertError
}

export async function upsertAgentPreferences(params: {
  clinicId: string
  agentKey: string
  prefs: Record<string, unknown>
}): Promise<void> {
  const supabase = createServerClient()
  const { data: existing } = await supabase
    .from('agent_preferences')
    .select('id, prefs')
    .eq('clinic_id', params.clinicId)
    .eq('agent_key', params.agentKey)
    .maybeSingle()

  const merged = {
    ...((existing?.prefs as Record<string, unknown>) ?? {}),
    ...params.prefs,
  } as unknown as Json

  if (existing) {
    const { error } = await supabase
      .from('agent_preferences')
      .update({ prefs: merged, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (error) throw error
    return
  }

  const { error } = await supabase.from('agent_preferences').insert({
    clinic_id: params.clinicId,
    agent_key: params.agentKey,
    prefs: merged,
  })
  if (error) throw error
}
