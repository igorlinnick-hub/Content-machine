import { loadSharedContext, saveScripts } from '@/lib/supabase/context'
import { createServerClient } from '@/lib/supabase/server'
import { runWriter, type PinnedFormat } from '@/lib/agents/writer'
import {
  studioScaffold,
  setStudioCurrentScript,
  type ShotType,
  type StudioVideo,
} from '@/lib/studio/videos'
import type { RoleBlock, RolePlan, StudioRolePayload } from '@/types'

// Studio idea generation. A Shot List video is turned into a simple shoot
// brief (steps + role-assigned script) adapted to the clinic's niche, then
// pinned to the video via current_script_id.

// shot_type 'doctor' — the doctor is on camera and speaks to lens.
// Patient / Assistant only if the format genuinely needs a second person.
const DOCTOR_ROLE_PLAN: RolePlan = {
  speakers: ['Doctor', 'Patient', 'Assistant'],
  guidance:
    'Filmed inside the clinic by a team member holding a phone. Doctor speaks directly to camera — conversational, no teleprompter. Patient or Assistant only when the format truly needs a second on-screen person. Keep it simple and doable for non-actors.',
  default_length: 'short',
}

// shot_type 'clinic' — the medical assistant films this ALONE, on a phone,
// without the doctor. The brief has to stand on its own: the MA reads it and
// shoots, with nobody explaining anything. summary_steps carry the whole
// shoot, so they must be literal — where to stand, what to point at, how long.
const CLINIC_ROLE_PLAN: RolePlan = {
  speakers: ['Assistant', 'Narrator', 'Patient'],
  guidance:
    'Filmed by a medical assistant alone, on a phone, inside the clinic. THE DOCTOR IS NOT AVAILABLE for this shoot — never write a line for the doctor and never require them on camera. No teleprompter, no second operator: every shot must be achievable by one person holding a phone (prop it against something for hands-free shots). Mostly visual b-roll carried by on-screen text or a short voiceover the MA records afterwards; spoken lines only when the format truly needs a face talking. Assume zero filming experience — say exactly where to stand, what to point the camera at, and how many seconds to hold each shot.',
  default_length: 'short',
}

// The Shot List mixes doctor talking-heads and MA-filmed clinic b-roll.
// Sending the doctor plan for a 'clinic' card is what forced the manual
// rewrite of every brief — the MA got instructions for a shoot they cannot do.
function rolePlanFor(shotType: ShotType | null | undefined): RolePlan {
  return shotType === 'clinic' ? CLINIC_ROLE_PLAN : DOCTOR_ROLE_PLAN
}

export interface StudioIdea {
  script_id: string
  topic: string
  hook: string
  script: string
  steps: string[]
  role_blocks: RoleBlock[] | null
}

// Generate a fresh idea for a video (does not persist the pin — callers
// decide). excludeHooks steers a regenerate away from the current hook.
export async function generateIdeaForVideo(
  clinicId: string,
  video: StudioVideo,
  opts?: { excludeHooks?: string[]; steer?: string | null }
): Promise<StudioIdea> {
  const context = await loadSharedContext(clinicId)
  const pinnedFormat: PinnedFormat = {
    templateName: `studio:${video.id.slice(0, 8)}`,
    scaffold: studioScaffold(video),
    description: video.style_description,
    rolePlan: rolePlanFor(video.shot_type),
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
    studioSteer: opts?.steer ?? null,
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

// Generate an idea AND pin it to the video (Shot List "Generate idea").
export async function generateAndPinIdea(
  clinicId: string,
  video: StudioVideo,
  opts?: { excludeHooks?: string[]; steer?: string | null }
): Promise<StudioIdea> {
  const idea = await generateIdeaForVideo(clinicId, video, opts)
  await setStudioCurrentScript(video.id, clinicId, idea.script_id)
  return idea
}

// Load a previously generated idea (the video's pinned current_script_id).
export async function loadStudioIdea(
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
  // role_blocks holds either {steps, blocks} or a legacy bare RoleBlock[].
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
