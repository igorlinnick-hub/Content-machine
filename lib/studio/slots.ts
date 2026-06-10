import { createServerClient } from '@/lib/supabase/server'
import {
  loadArsenalRow,
  type ArsenalRow,
} from '@/lib/arsenal/store'
import { arsenalToScaffold } from '@/lib/arsenal/template-bridge'
import { publicUrl } from '@/lib/arsenal/storage'
import { loadSharedContext, saveScripts } from '@/lib/supabase/context'
import { runWriter, type PinnedFormat } from '@/lib/agents/writer'
import type { RoleBlock, RolePlan } from '@/types'
import type { Json } from '@/types/supabase'

// Studio is a film board for the clinic team: a horizontal strip of
// columns, each pinned to one high-performing reference video. From the
// video we derive a structure schema + a template scaffold, and the
// Writer generates a role-assigned shoot idea. State (which video + which
// idea per column) lives in studio_slots so a reload is stable and the
// video only changes when the user presses "Change video".

export const STUDIO_DEFAULT_SLOTS = 3
export const STUDIO_MIN_VIEWS = 200_000

// Studio ideas are shoot briefs — break the script across on-camera
// roles. Writer decides the distribution within these allowed speakers.
const DEFAULT_ROLE_PLAN: RolePlan = {
  speakers: ['Doctor', 'Patient', 'Assistant', 'Narrator'],
  guidance:
    'Assign lines to fit the format. The Doctor carries the medical authority; use Patient for relatable reactions/questions, Narrator for framing and the CTA, Assistant only when a second on-camera person genuinely helps. Not every speaker must appear.',
  default_length: 'short',
}

export interface StudioIdea {
  script_id: string
  topic: string
  hook: string
  script: string
  role_blocks: RoleBlock[] | null
}

export interface StudioColumn {
  slot_index: number
  arsenal_id: string | null
  account: string | null
  view_count: number | null
  video_url: string | null
  thumbnail_url: string | null
  title: string | null
  schema_beats: { name: string; text: string }[]
  template_scaffold: string | null
  idea: StudioIdea | null
  // Set when the pool had nothing at/above STUDIO_MIN_VIEWS and we fell
  // back to the highest available video — surfaced as a subtle UI note.
  below_threshold?: boolean
}

// ——— Idea generation (shared by seed / regenerate / change-video) ———

export async function generateIdeaForArsenal(
  clinicId: string,
  arsenal: ArsenalRow,
  opts?: { excludeHooks?: string[] }
): Promise<StudioIdea> {
  const context = await loadSharedContext(clinicId)
  const pinnedFormat: PinnedFormat = {
    templateName: `studio:${arsenal.style_label}`,
    scaffold: arsenalToScaffold(arsenal),
    description: arsenal.style_description,
    rolePlan: DEFAULT_ROLE_PLAN,
    reference: {
      styleDescription: arsenal.style_description,
      transcriptExcerpt: arsenal.full_transcript,
      beats: arsenal.structure?.beats,
      hookVisual: arsenal.visual_notes?.hook_visual,
      brollPattern: arsenal.visual_notes?.broll_pattern,
    },
  }

  const out = await runWriter({
    context,
    variantCount: 1,
    lengthTarget: 'short',
    pinnedFormat,
    excludeHooks: opts?.excludeHooks,
  })
  const v = out.variants[0]
  if (!v) throw new Error('writer returned no variant for studio idea')

  const saved = await saveScripts(clinicId, [
    {
      variant_id: v.id,
      topic: v.topic,
      hook: v.hook,
      script: v.script,
      word_count: v.word_count,
      critic_score: 0,
      approved: false,
      length_target: 'short',
      template_used: pinnedFormat.templateName,
      role_blocks: v.role_blocks ?? null,
      format_template_id: null,
    },
  ])
  const scriptId = saved[0]?.id
  if (!scriptId) throw new Error('failed to save studio idea script')

  return {
    script_id: scriptId,
    topic: v.topic,
    hook: v.hook,
    script: v.script,
    role_blocks: v.role_blocks ?? null,
  }
}

// ——— Pool selection ———

interface PoolRow {
  id: string
  view_count: number | null
}

// Pick the next reference video for a column: prefer the highest-reach
// active video at/above the threshold that isn't already on the board;
// fall back to the highest available if the pool is thin. Returns the row
// id + whether we dropped below the threshold.
export async function pickNextArsenal(
  clinicId: string,
  opts: { exclude?: string[]; minViews?: number }
): Promise<{ arsenalId: string; belowThreshold: boolean } | null> {
  const minViews = opts.minViews ?? STUDIO_MIN_VIEWS
  const exclude = new Set((opts.exclude ?? []).filter(Boolean))
  const supabase = createServerClient()
  // Only videos with a playable storage path qualify — Studio plays them inline.
  const { data } = await supabase
    .from('script_arsenal')
    .select('id, view_count')
    .eq('clinic_id', clinicId)
    .eq('is_active', true)
    .not('video_storage_path', 'is', null)
    .order('view_count', { ascending: false, nullsFirst: false })
    .limit(60)
  const pool = ((data ?? []) as PoolRow[]).filter((r) => !exclude.has(r.id))
  if (pool.length === 0) return null

  const aboveThreshold = pool.find((r) => (r.view_count ?? 0) >= minViews)
  if (aboveThreshold) return { arsenalId: aboveThreshold.id, belowThreshold: false }
  // Nothing meets the bar — take the highest available and flag it.
  return { arsenalId: pool[0].id, belowThreshold: true }
}

// ——— Slot persistence ———

interface SlotRow {
  slot_index: number
  arsenal_id: string | null
  current_script_id: string | null
}

export async function setSlotArsenal(
  clinicId: string,
  slotIndex: number,
  arsenalId: string | null,
  scriptId: string | null
): Promise<void> {
  const supabase = createServerClient()
  await supabase.from('studio_slots').upsert(
    {
      clinic_id: clinicId,
      slot_index: slotIndex,
      arsenal_id: arsenalId,
      current_script_id: scriptId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'clinic_id,slot_index' }
  )
}

export async function setSlotScript(
  clinicId: string,
  slotIndex: number,
  scriptId: string
): Promise<void> {
  const supabase = createServerClient()
  await supabase
    .from('studio_slots')
    .update({ current_script_id: scriptId, updated_at: new Date().toISOString() })
    .eq('clinic_id', clinicId)
    .eq('slot_index', slotIndex)
}

export async function loadSlotRows(clinicId: string): Promise<SlotRow[]> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('studio_slots')
    .select('slot_index, arsenal_id, current_script_id')
    .eq('clinic_id', clinicId)
    .order('slot_index', { ascending: true })
  return (data ?? []) as SlotRow[]
}

async function loadIdea(
  clinicId: string,
  scriptId: string | null
): Promise<StudioIdea | null> {
  if (!scriptId) return null
  const supabase = createServerClient()
  const { data } = await supabase
    .from('scripts')
    .select('id, topic, hook, full_script, role_blocks')
    .eq('id', scriptId)
    .eq('clinic_id', clinicId)
    .maybeSingle()
  if (!data) return null
  return {
    script_id: data.id,
    topic: data.topic ?? '',
    hook: data.hook ?? '',
    script: data.full_script,
    role_blocks: (data.role_blocks as unknown as RoleBlock[] | null) ?? null,
  }
}

// Hydrate one column from its arsenal row + current idea.
export async function hydrateColumn(
  clinicId: string,
  slot: SlotRow,
  ideaOverride?: StudioIdea | null,
  belowThreshold?: boolean
): Promise<StudioColumn> {
  const arsenal = slot.arsenal_id
    ? await loadArsenalRow(slot.arsenal_id, clinicId)
    : null
  const idea =
    ideaOverride !== undefined
      ? ideaOverride
      : await loadIdea(clinicId, slot.current_script_id)
  return {
    slot_index: slot.slot_index,
    arsenal_id: arsenal?.id ?? null,
    account: arsenal?.author_handle ?? null,
    view_count: arsenal?.view_count ?? null,
    video_url: publicUrl(arsenal?.video_storage_path ?? null),
    thumbnail_url: publicUrl(arsenal?.thumbnail_storage_path ?? null),
    title: arsenal?.title ?? null,
    schema_beats: (arsenal?.structure?.beats ?? []).map((b) => ({
      name: b.name,
      text: b.text,
    })),
    template_scaffold: arsenal ? arsenalToScaffold(arsenal) : null,
    idea,
    below_threshold: belowThreshold,
  }
}

// ——— Seed + load ———

// Create the initial board: pick the top-N reachable videos and generate
// an idea for each. Idempotent-ish: only seeds when no slots exist.
export async function seedStudioSlots(
  clinicId: string,
  count = STUDIO_DEFAULT_SLOTS
): Promise<void> {
  const existing = await loadSlotRows(clinicId)
  if (existing.length > 0) return

  const used: string[] = []
  for (let i = 0; i < count; i++) {
    const pick = await pickNextArsenal(clinicId, { exclude: used })
    if (!pick) {
      // Pool exhausted (or empty) — create a placeholder slot so the
      // column renders an empty-state instead of vanishing.
      await setSlotArsenal(clinicId, i, null, null)
      continue
    }
    used.push(pick.arsenalId)
    const arsenal = await loadArsenalRow(pick.arsenalId, clinicId)
    let scriptId: string | null = null
    if (arsenal) {
      try {
        const idea = await generateIdeaForArsenal(clinicId, arsenal)
        scriptId = idea.script_id
      } catch {
        scriptId = null // idea gen failed (e.g. kill switch) — column shows video only
      }
    }
    await setSlotArsenal(clinicId, i, pick.arsenalId, scriptId)
  }
}

export async function loadStudioSlots(clinicId: string): Promise<StudioColumn[]> {
  const rows = await loadSlotRows(clinicId)
  return Promise.all(rows.map((r) => hydrateColumn(clinicId, r)))
}
