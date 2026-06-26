import { createServerClient } from '@/lib/supabase/server'

/**
 * Copies structural templates from an existing doctor (sourceClinicId) to a new
 * doctor (newClinicId). Called after creating a new doctor within an existing brand.
 *
 * What is copied (structure only — no content):
 *   - script_templates  (script scaffolds / formats)
 *   - clinic_categories (visual post categories for Canva)
 *   - post_references   (brand photos, logo, shared visual identity)
 *
 * What is NOT copied (starts fresh per doctor):
 *   - scripts, slide_sets, content_plan_topics, scheduled_posts
 *   - clinic_recordings, doctor_notes, diff_rules, insights
 *   - compliance grades (generated from the doctor's own niche field)
 *   - agent_prompts / agent_preferences / agent_learnings
 */
export async function seedDoctorFromSource(
  newClinicId: string,
  sourceClinicId: string
): Promise<void> {
  const supabase = createServerClient()

  // 1. script_templates — structural scaffolds (topics will be doctor-specific)
  const { data: templates } = await supabase
    .from('script_templates')
    .select('name, description, scaffold, length_bias, position, active')
    .eq('clinic_id', sourceClinicId)
    .eq('active', true)
    .order('position', { ascending: true })

  if (templates && templates.length > 0) {
    await supabase.from('script_templates').insert(
      templates.map((t) => ({ ...t, clinic_id: newClinicId }))
    )
  }

  // 2. clinic_categories — visual post categories (drive_folder_id is per-doctor so reset it)
  const { data: categories } = await supabase
    .from('clinic_categories')
    .select('slug, name, emoji, position, triggers, cta_template')
    .eq('clinic_id', sourceClinicId)
    .order('position', { ascending: true })

  if (categories && categories.length > 0) {
    await supabase.from('clinic_categories').insert(
      categories.map((c) => ({ ...c, clinic_id: newClinicId, drive_folder_id: null }))
    )
  }

  // 3. post_references — brand photos / logo shared across doctors in the same brand
  const { data: refs } = await supabase
    .from('post_references')
    .select('image_url, storage_path, label, mode, role, category_slug, notes, position, active')
    .eq('clinic_id', sourceClinicId)
    .eq('active', true)
    .order('position', { ascending: true })

  if (refs && refs.length > 0) {
    await supabase.from('post_references').insert(
      refs.map((r) => ({ ...r, clinic_id: newClinicId }))
    )
  }
}
