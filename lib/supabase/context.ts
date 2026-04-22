import type {
  SharedContext,
  ClinicProfile,
  Insight,
  TrendSignal,
  ContentItem,
  ScriptExample,
  DiffRule,
  VisualStyle,
  Tone,
  InsightType,
} from '@/types'
import { createServerClient } from './server'

const DEFAULT_VISUAL_STYLE: VisualStyle = {
  canvas: { width: 1080, height: 1080 },
  background: { type: 'color', overlay_opacity: 0 },
  text: {
    primary: { font: 'Inter', size: 64, color: '#0a0a0a', position: 'center' },
    secondary: { font: 'Inter', size: 32, color: '#525252' },
  },
  logo: { url: '', position: 'bottom-right', size: 80 },
  padding: 80,
}

export async function loadSharedContext(clinicId: string): Promise<SharedContext> {
  const supabase = createServerClient()
  const nowIso = new Date().toISOString()

  const [
    clinicRes,
    insightsRes,
    trendsRes,
    contentRes,
    fewShotRes,
    diffRulesRes,
    slideSetRes,
  ] = await Promise.all([
    supabase.from('clinics').select('*').eq('id', clinicId).single(),
    supabase
      .from('insights')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('trend_signals')
      .select('*')
      .eq('clinic_id', clinicId)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order('created_at', { ascending: false }),
    supabase
      .from('scripts')
      .select('id, topic, hook, full_script, created_at')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('few_shot_library')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('active', true)
      .order('score', { ascending: false, nullsFirst: false })
      .limit(10),
    supabase
      .from('diff_rules')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('active', true)
      .order('priority', { ascending: false }),
    supabase
      .from('slide_sets')
      .select('style_template')
      .eq('clinic_id', clinicId)
      .not('style_template', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (clinicRes.error || !clinicRes.data) {
    throw new Error(
      `loadSharedContext: clinic ${clinicId} not found (${clinicRes.error?.message ?? 'no row'})`
    )
  }

  const c = clinicRes.data
  const clinic_profile: ClinicProfile = {
    id: c.id,
    name: c.name,
    niche: 'regenerative_medicine',
    services: c.services ?? [],
    audience: c.audience ?? '',
    tone: (c.tone ?? 'educational') as Tone,
    doctor_name: c.doctor_name ?? '',
    medical_restrictions: c.medical_restrictions ?? [],
  }

  const raw_insights: Insight[] = (insightsRes.data ?? []).map((r) => ({
    id: r.id,
    type: (r.type ?? 'story') as InsightType,
    content: r.content,
    used_count: r.used_count ?? 0,
    created_at: r.created_at ?? nowIso,
  }))

  const trend_signals: TrendSignal[] = (trendsRes.data ?? []).map((r) => ({
    id: r.id,
    topic: r.topic,
    why_relevant: r.why_relevant,
    hook_angle: r.hook_angle,
    expires_at: r.expires_at,
    created_at: r.created_at ?? nowIso,
  }))

  const content_memory: ContentItem[] = (contentRes.data ?? []).map((r) => ({
    id: r.id,
    topic: r.topic,
    hook: r.hook,
    full_script: r.full_script,
    created_at: r.created_at ?? nowIso,
  }))

  const few_shot_library: ScriptExample[] = (fewShotRes.data ?? []).map((r) => ({
    id: r.id,
    script_text: r.script_text,
    why_good: r.why_good,
    topic: r.topic,
    score: r.score,
  }))

  const diff_rules: DiffRule[] = (diffRulesRes.data ?? []).map((r) => ({
    id: r.id,
    rule: r.rule,
    example_before: r.example_before,
    example_after: r.example_after,
    priority: r.priority ?? 3,
  }))

  const style_template: VisualStyle =
    (slideSetRes.data?.style_template as VisualStyle | null) ?? DEFAULT_VISUAL_STYLE

  return {
    clinic_profile,
    raw_insights,
    trend_signals,
    content_memory,
    few_shot_library,
    diff_rules,
    style_template,
  }
}

export async function saveInsights(
  clinicId: string,
  insights: Array<{ type: InsightType; content: string }>
): Promise<Insight[]> {
  if (insights.length === 0) return []
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('insights')
    .insert(insights.map((i) => ({ clinic_id: clinicId, type: i.type, content: i.content })))
    .select()
  if (error) throw error
  const nowIso = new Date().toISOString()
  return (data ?? []).map((r) => ({
    id: r.id,
    type: (r.type ?? 'story') as InsightType,
    content: r.content,
    used_count: r.used_count ?? 0,
    created_at: r.created_at ?? nowIso,
  }))
}

export async function saveTrendSignals(
  clinicId: string,
  signals: Array<{
    topic: string
    why_relevant?: string
    hook_angle?: string
    expires_in_days?: number
  }>
): Promise<TrendSignal[]> {
  if (signals.length === 0) return []
  const supabase = createServerClient()
  const rows = signals.map((s) => ({
    clinic_id: clinicId,
    topic: s.topic,
    why_relevant: s.why_relevant ?? null,
    hook_angle: s.hook_angle ?? null,
    expires_at: new Date(
      Date.now() + (s.expires_in_days ?? 14) * 24 * 60 * 60 * 1000
    ).toISOString(),
  }))
  const { data, error } = await supabase.from('trend_signals').insert(rows).select()
  if (error) throw error
  const nowIso = new Date().toISOString()
  return (data ?? []).map((r) => ({
    id: r.id,
    topic: r.topic,
    why_relevant: r.why_relevant,
    hook_angle: r.hook_angle,
    expires_at: r.expires_at,
    created_at: r.created_at ?? nowIso,
  }))
}

export async function saveDiffRules(
  clinicId: string,
  rules: Array<{
    rule: string
    example_before?: string
    example_after?: string
    priority?: number
  }>
): Promise<DiffRule[]> {
  if (rules.length === 0) return []
  const supabase = createServerClient()
  const rows = rules.map((r) => ({
    clinic_id: clinicId,
    rule: r.rule,
    example_before: r.example_before ?? null,
    example_after: r.example_after ?? null,
    priority: r.priority ?? 3,
  }))
  const { data, error } = await supabase.from('diff_rules').insert(rows).select()
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    rule: r.rule,
    example_before: r.example_before,
    example_after: r.example_after,
    priority: r.priority ?? 3,
  }))
}

export interface RecentScript {
  id: string
  variant_id: string | null
  topic: string | null
  hook: string | null
  full_script: string
  word_count: number | null
  critic_score: number | null
  approved: boolean | null
  google_doc_url: string | null
  created_at: string
}

export async function loadRecentScripts(
  clinicId: string,
  limit = 15
): Promise<RecentScript[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('scripts')
    .select(
      'id, variant_id, topic, hook, full_script, word_count, critic_score, approved, google_doc_url, created_at'
    )
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  const nowIso = new Date().toISOString()
  return (data ?? []).map((r) => ({
    id: r.id,
    variant_id: r.variant_id,
    topic: r.topic,
    hook: r.hook,
    full_script: r.full_script,
    word_count: r.word_count,
    critic_score: r.critic_score,
    approved: r.approved,
    google_doc_url: r.google_doc_url,
    created_at: r.created_at ?? nowIso,
  }))
}

export async function loadClinicList(): Promise<
  Array<{ id: string; name: string }>
> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('clinics')
    .select('id, name')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function loadClinicProfile(
  clinicId: string
): Promise<ClinicProfile> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('clinics')
    .select('*')
    .eq('id', clinicId)
    .single()
  if (error || !data) {
    throw new Error(
      `loadClinicProfile: clinic ${clinicId} not found (${error?.message ?? 'no row'})`
    )
  }
  return {
    id: data.id,
    name: data.name,
    niche: 'regenerative_medicine',
    services: data.services ?? [],
    audience: data.audience ?? '',
    tone: (data.tone ?? 'educational') as Tone,
    doctor_name: data.doctor_name ?? '',
    medical_restrictions: data.medical_restrictions ?? [],
  }
}

export interface ExportedScript {
  id: string
  clinic_id: string
  full_script: string
  google_doc_id: string
}

export async function loadExportedScriptsWithoutFinal(
  clinicId?: string
): Promise<ExportedScript[]> {
  const supabase = createServerClient()
  let query = supabase
    .from('scripts')
    .select('id, clinic_id, full_script, google_doc_id')
    .not('google_doc_id', 'is', null)
  if (clinicId) query = query.eq('clinic_id', clinicId)
  const { data: scripts, error } = await query
  if (error) throw error
  if (!scripts || scripts.length === 0) return []

  const scriptIds = scripts.map((s) => s.id)
  const { data: processedFinals, error: finalsErr } = await supabase
    .from('script_finals')
    .select('script_id')
    .in('script_id', scriptIds)
    .eq('diff_processed', true)
  if (finalsErr) throw finalsErr

  const processedIds = new Set(
    (processedFinals ?? []).map((r) => r.script_id).filter((x): x is string => !!x)
  )

  return scripts
    .filter((s) => s.clinic_id && s.google_doc_id && !processedIds.has(s.id))
    .map((s) => ({
      id: s.id,
      clinic_id: s.clinic_id as string,
      full_script: s.full_script,
      google_doc_id: s.google_doc_id as string,
    }))
}

export async function upsertScriptFinal(params: {
  scriptId: string
  clinicId: string
  finalText: string
  editedBy?: string
}): Promise<{ id: string }> {
  const supabase = createServerClient()
  const { data: existing } = await supabase
    .from('script_finals')
    .select('id')
    .eq('script_id', params.scriptId)
    .maybeSingle()

  if (existing) {
    const { data, error } = await supabase
      .from('script_finals')
      .update({
        final_text: params.finalText,
        edited_by: params.editedBy ?? null,
        diff_processed: true,
      })
      .eq('id', existing.id)
      .select('id')
      .single()
    if (error || !data) throw error ?? new Error('upsertScriptFinal: update returned no row')
    return { id: data.id }
  }

  const { data, error } = await supabase
    .from('script_finals')
    .insert({
      script_id: params.scriptId,
      clinic_id: params.clinicId,
      final_text: params.finalText,
      edited_by: params.editedBy ?? null,
      diff_processed: true,
    })
    .select('id')
    .single()
  if (error || !data) throw error ?? new Error('upsertScriptFinal: insert returned no row')
  return { id: data.id }
}

export async function saveDoctorNote(
  clinicId: string,
  params: { rawText: string; source?: 'widget' | 'voice' | 'text' }
): Promise<{ id: string }> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('doctor_notes')
    .insert({
      clinic_id: clinicId,
      raw_text: params.rawText,
      source: params.source ?? 'widget',
    })
    .select('id')
    .single()
  if (error || !data) throw error ?? new Error('saveDoctorNote: insert returned no row')
  return { id: data.id }
}

export async function markNoteProcessed(noteId: string): Promise<void> {
  const supabase = createServerClient()
  const { error } = await supabase
    .from('doctor_notes')
    .update({ processed: true })
    .eq('id', noteId)
  if (error) throw error
}

export interface ScoredVariant {
  variant_id: string
  topic: string
  hook: string
  script: string
  word_count: number
  critic_score: number
  approved: boolean
}

export async function saveScripts(
  clinicId: string,
  variants: ScoredVariant[]
): Promise<Array<{ id: string; variant_id: string }>> {
  if (variants.length === 0) return []
  const supabase = createServerClient()
  const rows = variants.map((v) => ({
    clinic_id: clinicId,
    variant_id: v.variant_id,
    topic: v.topic,
    hook: v.hook,
    full_script: v.script,
    word_count: v.word_count,
    critic_score: v.critic_score,
    approved: v.approved,
  }))
  const { data, error } = await supabase.from('scripts').insert(rows).select('id, variant_id')
  if (error) throw error
  return (data ?? []).map((r) => ({ id: r.id, variant_id: r.variant_id ?? '' }))
}

export async function saveFewShotExample(
  clinicId: string,
  example: { script_text: string; why_good?: string; topic?: string; score?: number }
): Promise<ScriptExample> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('few_shot_library')
    .insert({
      clinic_id: clinicId,
      script_text: example.script_text,
      why_good: example.why_good ?? null,
      topic: example.topic ?? null,
      score: example.score ?? null,
    })
    .select()
    .single()
  if (error || !data) throw error ?? new Error('saveFewShotExample: insert returned no row')
  return {
    id: data.id,
    script_text: data.script_text,
    why_good: data.why_good,
    topic: data.topic,
    score: data.score,
  }
}
