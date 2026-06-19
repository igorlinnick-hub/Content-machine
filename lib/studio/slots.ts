import { loadSharedContext, saveScripts } from '@/lib/supabase/context'
import { createServerClient } from '@/lib/supabase/server'
import { runWriter, type PinnedFormat } from '@/lib/agents/writer'
import {
  studioScaffold,
  setStudioCurrentScript,
  type StudioVideo,
} from '@/lib/studio/videos'
import type { RoleBlock, RolePlan, StudioRolePayload } from '@/types'

// Studio idea generation. A Shot List video is turned into a simple shoot
// brief (steps + role-assigned script) adapted to the clinic's niche, then
// pinned to the video via current_script_id.

// Filmed inside the clinic by non-actor staff. Doctor speaks to camera.
// Patient / Assistant only if the format genuinely needs a second person.
const DEFAULT_ROLE_PLAN: RolePlan = {
  speakers: ['Doctor', 'Patient', 'Assistant'],
  guidance:
    'Filmed inside the clinic by a team member holding a phone. Doctor speaks directly to camera — conversational, no teleprompter. Patient or Assistant only when the format truly needs a second on-screen person. Keep it simple and doable for non-actors.',
  default_length: 'short',
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
