import { createServerClient } from '@/lib/supabase/server'

export type ScriptTemplateLengthBias = 'short' | 'long'

export interface ScriptTemplate {
  id: string
  clinic_id: string
  name: string
  description: string | null
  scaffold: string
  length_bias: ScriptTemplateLengthBias | null
  position: number
  active: boolean
  created_at: string
}

export interface ScriptTemplateInput {
  name: string
  description?: string | null
  scaffold: string
  length_bias?: ScriptTemplateLengthBias | null
}

export async function loadScriptTemplates(
  clinicId: string,
  opts: { activeOnly?: boolean } = {}
): Promise<ScriptTemplate[]> {
  const supabase = createServerClient()
  let q = supabase
    .from('script_templates')
    .select(
      'id, clinic_id, name, description, scaffold, length_bias, position, active, created_at'
    )
    .eq('clinic_id', clinicId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: false })
  if (opts.activeOnly !== false) q = q.eq('active', true)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as ScriptTemplate[]
}

export async function insertScriptTemplate(
  clinicId: string,
  input: ScriptTemplateInput
): Promise<ScriptTemplate> {
  if (!input.name.trim() || !input.scaffold.trim()) {
    throw new Error('name and scaffold are required')
  }
  const supabase = createServerClient()
  const { count } = await supabase
    .from('script_templates')
    .select('id', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
    .eq('active', true)

  const { data, error } = await supabase
    .from('script_templates')
    .insert({
      clinic_id: clinicId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      scaffold: input.scaffold.trim(),
      length_bias: input.length_bias ?? null,
      position: count ?? 0,
    })
    .select()
    .single()
  if (error || !data) throw error ?? new Error('insert returned no row')
  return data as ScriptTemplate
}

export async function updateScriptTemplate(
  templateId: string,
  patch: Partial<ScriptTemplateInput> & { active?: boolean; position?: number }
): Promise<ScriptTemplate> {
  const supabase = createServerClient()
  const update: {
    name?: string
    description?: string | null
    scaffold?: string
    length_bias?: ScriptTemplateLengthBias | null
    active?: boolean
    position?: number
  } = {}
  if (patch.name !== undefined) update.name = patch.name.trim()
  if (patch.description !== undefined)
    update.description = patch.description?.trim() || null
  if (patch.scaffold !== undefined) update.scaffold = patch.scaffold.trim()
  if (patch.length_bias !== undefined) update.length_bias = patch.length_bias
  if (patch.active !== undefined) update.active = patch.active
  if (patch.position !== undefined) update.position = patch.position

  const { data, error } = await supabase
    .from('script_templates')
    .update(update)
    .eq('id', templateId)
    .select()
    .single()
  if (error || !data) throw error ?? new Error('update returned no row')
  return data as ScriptTemplate
}

export async function deleteScriptTemplate(templateId: string): Promise<void> {
  const supabase = createServerClient()
  const { error } = await supabase
    .from('script_templates')
    .delete()
    .eq('id', templateId)
  if (error) throw error
}

// Pick at most `limit` templates, preferring those that match the requested
// length budget. Used by the writer to pass a small set of structural
// scaffolds — too many confuses the model.
export function pickTemplatesForLength(
  templates: ScriptTemplate[],
  lengthBias: ScriptTemplateLengthBias,
  limit = 4
): ScriptTemplate[] {
  if (templates.length === 0) return []
  const matching = templates.filter(
    (t) => t.length_bias === null || t.length_bias === lengthBias
  )
  return matching.slice(0, limit)
}
