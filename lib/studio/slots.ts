import { createServerClient } from '@/lib/supabase/server'
import { publicUrl } from '@/lib/arsenal/storage'
import { loadSharedContext, saveScripts } from '@/lib/supabase/context'
import { runWriter, type PinnedFormat } from '@/lib/agents/writer'
import {
  loadStudioVideo,
  pickNextStudioVideo,
  studioScaffold,
  type StudioVideo,
} from '@/lib/studio/videos'
import type { RoleBlock, RolePlan, StudioRolePayload } from '@/types'

// Studio is a film board for the clinic team: a horizontal strip of
// columns, each pinned to one reference video from the clinic's OWN
// curated base (studio_videos — separate from the doctor-script arsenal).
// State (which video + which idea per column) lives in studio_slots so a
// reload is stable and the video only changes on "Change video".

export const STUDIO_DEFAULT_SLOTS = 3

// Studio ideas are shoot briefs filmed by the clinic's own staff INSIDE
// the clinic. Doctor on camera; Operator is the person behind the camera
// (a line or just an action). Patient only when the format needs one.
const DEFAULT_ROLE_PLAN: RolePlan = {
  speakers: ['Doctor', 'Operator', 'Patient'],
  guidance:
    'Filmed inside the clinic by non-actor staff. Doctor carries the medical authority on camera; Operator (behind the camera) gives short cues or on-screen actions; Patient only when the format truly needs a second person. Keep it simple and doable. Not every speaker must appear.',
  default_length: 'short',
}

export interface StudioIdea {
  script_id: string
  topic: string
  hook: string
  script: string
  // Simple "what we'll film" steps for non-actor staff.
  steps: string[]
  role_blocks: RoleBlock[] | null
}

export interface StudioColumn {
  slot_index: number
  video_id: string | null
  account: string | null
  view_count: number | null
  video_url: string | null
  thumbnail_url: string | null
  title: string | null
  schema_beats: { name: string; text: string }[]
  template_scaffold: string | null
  idea: StudioIdea | null
}

// ——— Idea generation (shared by seed / regenerate / change-video) ———

export async function generateIdeaForVideo(
  clinicId: string,
  video: StudioVideo,
  opts?: { excludeHooks?: string[] }
): Promise<StudioIdea> {
  const context = await loadSharedContext(clinicId)
  const pinnedFormat: PinnedFormat = {
    templateName: `studio:${video.id.slice(0, 8)}`,
    scaffold: studioScaffold(video),
    description: video.style_description,
    rolePlan: DEFAULT_ROLE_PLAN,
    reference: {
      styleDescription: video.style_description,
      transcriptExcerpt: video.caption,
      beats: video.structure?.beats,
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

  const steps = v.summary_steps ?? []
  const blocks = v.role_blocks ?? []
  const payload: StudioRolePayload = { steps, blocks }

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
      role_blocks: payload,
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
    steps,
    role_blocks: blocks,
  }
}

// ——— Slot persistence ———

interface SlotRow {
  slot_index: number
  studio_video_id: string | null
  current_script_id: string | null
}

export async function setSlotVideo(
  clinicId: string,
  slotIndex: number,
  videoId: string | null,
  scriptId: string | null
): Promise<void> {
  const supabase = createServerClient()
  await supabase.from('studio_slots').upsert(
    {
      clinic_id: clinicId,
      slot_index: slotIndex,
      studio_video_id: videoId,
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
    .select('slot_index, studio_video_id, current_script_id')
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
  // role_blocks holds either the new {steps, blocks} payload or a legacy
  // bare RoleBlock[] (steps-less). Normalise both.
  const raw = data.role_blocks as unknown
  let steps: string[] = []
  let blocks: RoleBlock[] | null = null
  if (Array.isArray(raw)) {
    blocks = raw as RoleBlock[]
  } else if (raw && typeof raw === 'object') {
    const p = raw as Partial<StudioRolePayload>
    steps = Array.isArray(p.steps) ? p.steps : []
    blocks = Array.isArray(p.blocks) ? p.blocks : null
  }
  return {
    script_id: data.id,
    topic: data.topic ?? '',
    hook: data.hook ?? '',
    script: data.full_script,
    steps,
    role_blocks: blocks,
  }
}

// Hydrate one column from its studio video + current idea.
export async function hydrateColumn(
  clinicId: string,
  slot: SlotRow,
  ideaOverride?: StudioIdea | null
): Promise<StudioColumn> {
  const video = slot.studio_video_id
    ? await loadStudioVideo(slot.studio_video_id, clinicId)
    : null
  const idea =
    ideaOverride !== undefined
      ? ideaOverride
      : await loadIdea(clinicId, slot.current_script_id)
  return {
    slot_index: slot.slot_index,
    video_id: video?.id ?? null,
    account: video?.author_handle ?? null,
    view_count: video?.view_count ?? null,
    video_url: publicUrl(video?.video_storage_path ?? null),
    thumbnail_url: publicUrl(video?.thumbnail_storage_path ?? null),
    title: video?.title ?? null,
    schema_beats: (video?.structure?.beats ?? []).map((b) => ({
      name: b.name,
      text: b.text,
    })),
    template_scaffold: video ? studioScaffold(video) : null,
    idea,
  }
}

// ——— Seed + load ———

// Create the initial board: pick the first N videos from the base and
// generate an idea for each. Only seeds when no slots exist yet.
export async function seedStudioSlots(
  clinicId: string,
  count = STUDIO_DEFAULT_SLOTS
): Promise<void> {
  const existing = await loadSlotRows(clinicId)
  if (existing.length > 0) return

  const used: string[] = []
  for (let i = 0; i < count; i++) {
    const pick = await pickNextStudioVideo(clinicId, { exclude: used })
    if (!pick) break // pool exhausted — fewer columns than count is fine
    used.push(pick.videoId)
    const video = await loadStudioVideo(pick.videoId, clinicId)
    let scriptId: string | null = null
    if (video) {
      try {
        const idea = await generateIdeaForVideo(clinicId, video)
        scriptId = idea.script_id
      } catch {
        scriptId = null // idea gen failed (e.g. kill switch) — show video only
      }
    }
    await setSlotVideo(clinicId, i, pick.videoId, scriptId)
  }
}

export async function loadStudioSlots(clinicId: string): Promise<StudioColumn[]> {
  const rows = await loadSlotRows(clinicId)
  return Promise.all(rows.map((r) => hydrateColumn(clinicId, r)))
}
