import { createServerClient } from '@/lib/supabase/server'
import type { VisualStyle, SlideSetStatus } from '@/types'
import type { Json } from '@/types/supabase'

function toJson<T>(value: T): Json {
  return JSON.parse(JSON.stringify(value)) as Json
}

export const DEFAULT_VISUAL_STYLE: VisualStyle = {
  canvas: { width: 1080, height: 1080 },
  background: { type: 'color', overlay_opacity: 0 },
  text: {
    primary: { font: 'Inter', size: 64, color: '#0a0a0a', position: 'center' },
    secondary: { font: 'Inter', size: 32, color: '#525252' },
  },
  logo: { url: '', position: 'bottom-right', size: 80 },
  padding: 80,
}

export async function loadStyleTemplate(clinicId: string): Promise<VisualStyle> {
  const supabase = createServerClient()
  const [styleRow, clinicRow] = await Promise.all([
    supabase
      .from('slide_sets')
      .select('style_template')
      .eq('clinic_id', clinicId)
      .not('style_template', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('clinics')
      .select('logo_url')
      .eq('id', clinicId)
      .maybeSingle(),
  ])

  const base =
    (styleRow.data?.style_template as unknown as VisualStyle | undefined) ??
    DEFAULT_VISUAL_STYLE
  const clinicLogo = (clinicRow.data?.logo_url as string | null | undefined) ?? null

  // Clinic-level logo wins unless the saved style explicitly set one
  // (in which case the per-style override is intentional).
  if (clinicLogo && (!base.logo.url || base.logo.url.trim().length === 0)) {
    return { ...base, logo: { ...base.logo, url: clinicLogo } }
  }
  return base
}

export async function saveStyleTemplate(
  clinicId: string,
  style: VisualStyle
): Promise<{ id: string }> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('slide_sets')
    .insert({
      clinic_id: clinicId,
      slides: toJson([]),
      style_template: toJson(style),
      status: 'pending',
    })
    .select('id')
    .single()
  if (error || !data) throw error ?? new Error('saveStyleTemplate: insert returned no row')
  return { id: data.id }
}

export interface SlideSetRecord {
  id: string
  clinic_id: string
  script_id: string | null
  slides: string[]
  style_template: VisualStyle
  drive_folder_id: string | null
  status: SlideSetStatus
  created_at: string
}

export interface LoadScriptForRender {
  id: string
  clinic_id: string
  full_script: string
  topic: string | null
  hook: string | null
}

export async function loadScriptForRender(
  scriptId: string
): Promise<LoadScriptForRender> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('scripts')
    .select('id, clinic_id, full_script, topic, hook')
    .eq('id', scriptId)
    .single()
  if (error || !data || !data.clinic_id) {
    throw new Error(
      `loadScriptForRender: script ${scriptId} not found (${error?.message ?? 'no row'})`
    )
  }
  return {
    id: data.id,
    clinic_id: data.clinic_id,
    full_script: data.full_script,
    topic: data.topic,
    hook: data.hook,
  }
}

export async function createSlideSet(params: {
  clinicId: string
  scriptId: string
  slides: string[]
  styleTemplate: VisualStyle
  driveFolderId?: string | null
  categoryId?: string | null
  status?: SlideSetStatus
}): Promise<{ id: string }> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('slide_sets')
    .insert({
      clinic_id: params.clinicId,
      script_id: params.scriptId,
      slides: toJson(params.slides),
      style_template: toJson(params.styleTemplate),
      drive_folder_id: params.driveFolderId ?? null,
      category_id: params.categoryId ?? null,
      status: params.status ?? 'rendered',
    })
    .select('id')
    .single()
  if (error || !data) throw error ?? new Error('createSlideSet: insert returned no row')
  return { id: data.id }
}

export async function loadSlideSet(slideSetId: string): Promise<SlideSetRecord> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('slide_sets')
    .select('*')
    .eq('id', slideSetId)
    .single()
  if (error || !data || !data.clinic_id) {
    throw new Error(
      `loadSlideSet: slide_set ${slideSetId} not found (${error?.message ?? 'no row'})`
    )
  }

  const slides = Array.isArray(data.slides)
    ? (data.slides as unknown[]).filter((x): x is string => typeof x === 'string')
    : []

  return {
    id: data.id,
    clinic_id: data.clinic_id,
    script_id: data.script_id,
    slides,
    style_template: data.style_template as unknown as VisualStyle,
    drive_folder_id: data.drive_folder_id,
    status: (data.status ?? 'rendered') as SlideSetStatus,
    created_at: data.created_at ?? new Date().toISOString(),
  }
}

export async function markSlideSetStatus(
  slideSetId: string,
  status: SlideSetStatus
): Promise<void> {
  const supabase = createServerClient()
  const { error } = await supabase
    .from('slide_sets')
    .update({ status })
    .eq('id', slideSetId)
  if (error) throw error
}

export async function loadRecentSlideSets(
  clinicId: string,
  limit = 10
): Promise<Array<Pick<SlideSetRecord, 'id' | 'script_id' | 'status' | 'created_at'> & { slide_count: number }>> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('slide_sets')
    .select('id, script_id, status, created_at, slides')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  const nowIso = new Date().toISOString()
  return (data ?? []).map((r) => ({
    id: r.id,
    script_id: r.script_id,
    status: (r.status ?? 'rendered') as SlideSetStatus,
    created_at: r.created_at ?? nowIso,
    slide_count: Array.isArray(r.slides) ? (r.slides as unknown[]).length : 0,
  }))
}

export interface PostListItem {
  slide_set_id: string
  script_id: string | null
  topic: string | null
  hook: string | null
  script: string | null
  slide_count: number
  status: SlideSetStatus
  created_at: string
  category: { id: string; name: string; emoji: string | null } | null
}

export async function loadPosts(
  clinicId: string,
  limit = 30
): Promise<PostListItem[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('slide_sets')
    .select(
      'id, script_id, status, created_at, slides, scripts ( topic, hook, full_script ), clinic_categories ( id, name, emoji )'
    )
    .eq('clinic_id', clinicId)
    .not('script_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  const nowIso = new Date().toISOString()
  return (data ?? []).map((r) => {
    const s = Array.isArray(r.scripts) ? r.scripts[0] : r.scripts
    const cat = Array.isArray(r.clinic_categories)
      ? r.clinic_categories[0]
      : r.clinic_categories
    return {
      slide_set_id: r.id,
      script_id: r.script_id,
      topic: s?.topic ?? null,
      hook: s?.hook ?? null,
      script: s?.full_script ?? null,
      slide_count: Array.isArray(r.slides) ? (r.slides as unknown[]).length : 0,
      status: (r.status ?? 'rendered') as SlideSetStatus,
      created_at: r.created_at ?? nowIso,
      category: cat ? { id: cat.id, name: cat.name, emoji: cat.emoji } : null,
    }
  })
}

export async function deletePost(slideSetId: string): Promise<void> {
  const supabase = createServerClient()
  const { error } = await supabase
    .from('slide_sets')
    .delete()
    .eq('id', slideSetId)
  if (error) throw error
}
