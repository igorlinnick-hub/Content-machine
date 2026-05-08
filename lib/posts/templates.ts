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

// Six default structural scaffolds — every clinic gets these on first use.
// They live on the backend; the user does not touch them. Writer picks one
// per variant and uses it as the structural skeleton for the post.
export const DEFAULT_SCRIPT_TEMPLATES: Array<{
  name: string
  description: string
  scaffold: string
  length_bias: ScriptTemplateLengthBias | null
}> = [
  {
    name: 'System critique',
    description:
      'Why mainstream care fails this problem and what that means for the patient.',
    scaffold: `[Hook — a sentence that contradicts the standard medical line on this topic.]
[Why the system gets it wrong — one specific reason, not a vague rant. Mechanism or incentive, not buzzwords.]
[What gets missed — the thing patients keep paying for that does not actually move the needle.]
[What we do instead — concrete, mechanism-backed, named. Show the actual decision, not slogans.]
[CTA — a single specific next step.]`,
    length_bias: null,
  },
  {
    name: 'Diagnostic deep-dive',
    description:
      'Take one symptom or condition and unpack the real mechanism.',
    scaffold: `[Hook — a symptom-as-question, the kind a patient types into Google at 2am.]
[The wrong story — what most people are told about it.]
[The actual mechanism — explained in everyday physical terms, not jargon. Use a concrete metaphor.]
[Why this changes the treatment — what you stop doing, what you start doing.]
[CTA — book the right kind of evaluation.]`,
    length_bias: null,
  },
  {
    name: 'Patient story',
    description:
      'Anonymised case the doctor sees often, told as a small narrative.',
    scaffold: `[Hook — one line that sets up the patient: who they are, what they came in for. No names.]
[What they had already tried — be specific so the audience recognises themselves.]
[The turning point — the question or test or insight that changed the plan.]
[What we did and why it worked — mechanism, not testimonial.]
[CTA — for someone who recognises themselves in this story.]`,
    length_bias: null,
  },
  {
    name: 'Expert secrets',
    description:
      'What the doctor would tell a friend that he does not say in a 10-minute visit.',
    scaffold: `[Hook — "Here is what most doctors will not tell you about ___."]
[Reveal #1 — a counter-intuitive fact about the topic. One sentence.]
[Reveal #2 — a step the patient can take or watch for, that most clinicians never mention. One sentence.]
[Reveal #3 — what the doctor actually looks for when deciding the treatment plan. One sentence.]
[Why this matters — what changes if you act on it.]
[CTA — invite a real conversation, not a generic booking line.]`,
    length_bias: null,
  },
  {
    name: 'Medicine philosophy',
    description:
      'A short, opinionated piece on how the doctor thinks about treating this kind of patient.',
    scaffold: `[Hook — a strong opinion stated plainly. Not "I think". Just the claim.]
[Where this opinion comes from — clinical observation, not theory. Be specific.]
[What it means for how we treat — the practical decision the philosophy drives.]
[What it does NOT mean — clear up the obvious counter-argument before someone makes it.]
[CTA — find out if this approach fits you.]`,
    length_bias: null,
  },
  {
    name: 'Myth-busting',
    description:
      '"You have probably heard X. Here is why that is wrong." Three myths max.',
    scaffold: `[Hook — name the topic and promise to debunk what people think they know.]
[Myth 1 — quote the myth, then in one or two sentences show why it is wrong with a fact, not an opinion.]
[Myth 2 — same shape. Concrete fact, no jargon.]
[Myth 3 — same shape. End with what is actually true.]
[CTA — for someone who thought they understood this.]`,
    length_bias: null,
  },
]

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

// Seed every clinic with the 6 default structural scaffolds the first time
// the writer is invoked. Idempotent: returns existing templates if any.
export async function ensureDefaultScriptTemplates(
  clinicId: string
): Promise<ScriptTemplate[]> {
  const existing = await loadScriptTemplates(clinicId, { activeOnly: false })
  if (existing.length > 0) return existing
  const supabase = createServerClient()
  const rows = DEFAULT_SCRIPT_TEMPLATES.map((t, i) => ({
    clinic_id: clinicId,
    name: t.name,
    description: t.description,
    scaffold: t.scaffold,
    length_bias: t.length_bias,
    position: i,
  }))
  const { error } = await supabase.from('script_templates').insert(rows)
  if (error) throw error
  return loadScriptTemplates(clinicId, { activeOnly: false })
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
