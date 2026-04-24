import { createServerClient } from '@/lib/supabase/server'

export interface PlanTopic {
  id: string
  topic: string
  position: number
  status: 'pending' | 'done' | 'skipped'
  last_script_id: string | null
  completed_at: string | null
  created_at: string
}

export async function loadPlan(clinicId: string): Promise<PlanTopic[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('content_plan_topics')
    .select(
      'id, topic, position, status, last_script_id, completed_at, created_at'
    )
    .eq('clinic_id', clinicId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    topic: r.topic,
    position: r.position,
    status: (r.status ?? 'pending') as PlanTopic['status'],
    last_script_id: r.last_script_id,
    completed_at: r.completed_at,
    created_at: r.created_at,
  }))
}

export async function replacePlan(
  clinicId: string,
  topics: string[]
): Promise<PlanTopic[]> {
  const supabase = createServerClient()
  const cleaned = topics.map((t) => t.trim()).filter((t) => t.length > 0)

  const existing = await loadPlan(clinicId)
  const existingByText = new Map(existing.map((t) => [t.topic, t]))

  // Wipe rows whose topic is no longer in the new list AND were never used.
  const newSet = new Set(cleaned)
  const toDelete = existing
    .filter((t) => !newSet.has(t.topic) && t.last_script_id === null)
    .map((t) => t.id)
  if (toDelete.length > 0) {
    await supabase.from('content_plan_topics').delete().in('id', toDelete)
  }

  // Reposition / insert.
  const upserts = cleaned.map((text, i) => {
    const prior = existingByText.get(text)
    return prior
      ? { id: prior.id, position: i }
      : { clinic_id: clinicId, topic: text, position: i, status: 'pending' as const }
  })

  // Split into updates vs inserts.
  const updates = upserts.filter(
    (u): u is { id: string; position: number } => 'id' in u
  )
  const inserts = upserts.filter(
    (u): u is { clinic_id: string; topic: string; position: number; status: 'pending' } =>
      'clinic_id' in u
  )

  for (const u of updates) {
    await supabase
      .from('content_plan_topics')
      .update({ position: u.position })
      .eq('id', u.id)
  }
  if (inserts.length > 0) {
    const { error } = await supabase.from('content_plan_topics').insert(inserts)
    if (error) throw error
  }

  return loadPlan(clinicId)
}

export async function updateTopic(
  topicId: string,
  patch: { status?: PlanTopic['status']; topic?: string; last_script_id?: string }
): Promise<PlanTopic | null> {
  const supabase = createServerClient()
  const update: {
    status?: string
    completed_at?: string | null
    topic?: string
    last_script_id?: string
  } = {}
  if (patch.status) {
    update.status = patch.status
    update.completed_at = patch.status === 'done' ? new Date().toISOString() : null
  }
  if (patch.topic) update.topic = patch.topic
  if (patch.last_script_id) update.last_script_id = patch.last_script_id

  const { data, error } = await supabase
    .from('content_plan_topics')
    .update(update)
    .eq('id', topicId)
    .select(
      'id, topic, position, status, last_script_id, completed_at, created_at'
    )
    .single()
  if (error) throw error
  if (!data) return null
  return {
    id: data.id,
    topic: data.topic,
    position: data.position,
    status: (data.status ?? 'pending') as PlanTopic['status'],
    last_script_id: data.last_script_id,
    completed_at: data.completed_at,
    created_at: data.created_at,
  }
}

export async function deleteTopic(topicId: string): Promise<void> {
  const supabase = createServerClient()
  const { error } = await supabase
    .from('content_plan_topics')
    .delete()
    .eq('id', topicId)
  if (error) throw error
}

export async function getTopic(topicId: string): Promise<PlanTopic | null> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('content_plan_topics')
    .select(
      'id, topic, position, status, last_script_id, completed_at, created_at'
    )
    .eq('id', topicId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    id: data.id,
    topic: data.topic,
    position: data.position,
    status: (data.status ?? 'pending') as PlanTopic['status'],
    last_script_id: data.last_script_id,
    completed_at: data.completed_at,
    created_at: data.created_at,
  }
}
