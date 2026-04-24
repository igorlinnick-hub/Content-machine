import { createServerClient } from '@/lib/supabase/server'

export interface Category {
  id: string
  slug: string
  name: string
  emoji: string | null
  position: number
  triggers: string[]
  drive_folder_id: string | null
  cta_template: string | null
}

export interface CategoryInput {
  slug: string
  name: string
  emoji?: string | null
  triggers?: string[]
  drive_folder_id?: string | null
  cta_template?: string | null
}

export const DEFAULT_CATEGORIES: CategoryInput[] = [
  {
    slug: 'mental_health',
    name: 'Mental Health',
    emoji: '🧠',
    triggers: [
      'TMS', 'Ketamine', 'SGB', 'Spravato', 'Reset', 'Clarity', 'Relief',
      'Depression', 'Anxiety', 'PTSD', 'Trauma', 'Mood',
    ],
  },
  {
    slug: 'pain_joint',
    name: 'Pain & Joint',
    emoji: '🦴',
    triggers: [
      'GLP', 'Shots', 'Transform', 'PRP', 'A2M', 'Biologics', 'Biologic',
      'Regenerative', 'Cartilage', 'Arthritis', 'Joint',
    ],
  },
  {
    slug: 'wellness_vitality',
    name: 'Wellness & Vitality',
    emoji: '✨',
    triggers: [
      'IV', 'NAD', 'Peptide', 'Hormones', 'Boost', 'Energy', 'NAD+',
      'Testosterone', 'Estrogen', 'Thyroid', 'Infusion', 'Drip',
    ],
  },
  {
    slug: 'weight_loss',
    name: 'Medical Weight Loss',
    emoji: '⚖️',
    triggers: [
      'Weight loss', 'GLP-1', 'Injection', 'Program', 'Results',
      'Semaglutide', 'Tirzepatide', 'Retatrutide', 'Ozempic',
      'Appetite', 'Metabolism',
    ],
  },
]

export async function loadCategories(clinicId: string): Promise<Category[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('clinic_categories')
    .select(
      'id, slug, name, emoji, position, triggers, drive_folder_id, cta_template'
    )
    .eq('clinic_id', clinicId)
    .order('position', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    emoji: r.emoji,
    position: r.position,
    triggers: r.triggers ?? [],
    drive_folder_id: r.drive_folder_id,
    cta_template: r.cta_template,
  }))
}

export async function ensureDefaultCategories(
  clinicId: string
): Promise<Category[]> {
  const existing = await loadCategories(clinicId)
  if (existing.length > 0) return existing
  const supabase = createServerClient()
  const rows = DEFAULT_CATEGORIES.map((c, i) => ({
    clinic_id: clinicId,
    slug: c.slug,
    name: c.name,
    emoji: c.emoji ?? null,
    position: i,
    triggers: c.triggers ?? [],
    drive_folder_id: c.drive_folder_id ?? null,
    cta_template: c.cta_template ?? null,
  }))
  const { error } = await supabase.from('clinic_categories').insert(rows)
  if (error) throw error
  return loadCategories(clinicId)
}

export async function replaceCategories(
  clinicId: string,
  categories: Array<CategoryInput & { id?: string }>
): Promise<Category[]> {
  const supabase = createServerClient()
  const existing = await loadCategories(clinicId)
  const existingBySlug = new Map(existing.map((c) => [c.slug, c]))

  const incomingSlugs = new Set(categories.map((c) => c.slug))
  const toDelete = existing.filter((c) => !incomingSlugs.has(c.slug)).map((c) => c.id)
  if (toDelete.length > 0) {
    await supabase.from('clinic_categories').delete().in('id', toDelete)
  }

  for (let i = 0; i < categories.length; i++) {
    const c = categories[i]
    const prior = existingBySlug.get(c.slug)
    if (prior) {
      await supabase
        .from('clinic_categories')
        .update({
          name: c.name,
          emoji: c.emoji ?? null,
          position: i,
          triggers: c.triggers ?? [],
          drive_folder_id: c.drive_folder_id ?? null,
          cta_template: c.cta_template ?? null,
        })
        .eq('id', prior.id)
    } else {
      const { error } = await supabase.from('clinic_categories').insert({
        clinic_id: clinicId,
        slug: c.slug,
        name: c.name,
        emoji: c.emoji ?? null,
        position: i,
        triggers: c.triggers ?? [],
        drive_folder_id: c.drive_folder_id ?? null,
        cta_template: c.cta_template ?? null,
      })
      if (error) throw error
    }
  }

  return loadCategories(clinicId)
}

// Substring-based scoring matcher. Topic + first 400 chars of script
// are searched (case-insensitive) against each trigger; longer triggers
// score more (they're more specific).
export function matchCategory(
  haystack: string,
  categories: Category[]
): { category: Category; score: number; hits: string[] } | null {
  const text = haystack.toLowerCase()
  let best: { category: Category; score: number; hits: string[] } | null = null
  for (const c of categories) {
    let score = 0
    const hits: string[] = []
    for (const trigger of c.triggers) {
      const t = trigger.trim()
      if (!t) continue
      const tl = t.toLowerCase()
      // Word-boundary-ish check: match whole token to avoid 'IV' matching
      // 'invasive'. Allow trigger to contain spaces / dashes.
      const escaped = tl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp(`(^|[^a-z0-9+])${escaped}(?=[^a-z0-9+]|$)`, 'i')
      if (re.test(text)) {
        score += Math.max(1, tl.length)
        hits.push(t)
      }
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { category: c, score, hits }
    }
  }
  return best
}
