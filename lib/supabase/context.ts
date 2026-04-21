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
