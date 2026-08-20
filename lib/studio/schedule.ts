import { createServerClient } from '@/lib/supabase/server'
import { randomBytes } from 'crypto'
import { publicUrl } from '@/lib/arsenal/storage'
import type { StudioVideo, StudioVideoStructure, ShotType } from '@/lib/studio/videos'

// The shoot board: Shot List videos pinned to a calendar day, one per day,
// read by the MAs on their own link. Scheduling lives here rather than in
// videos.ts because it owns a rule videos.ts has no business knowing — the
// one-per-day search for the next open slot.

// The clinic films in Hawaii (UTC-10). Deriving "today" from UTC would flip
// the board to tomorrow's card at 2pm local, so the day is always resolved
// in this zone. Change here if a clinic outside Hawaii onboards.
const BOARD_TZ = 'Pacific/Honolulu'

// 'en-CA' formats as YYYY-MM-DD, which is what a postgres `date` wants.
export function boardToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BOARD_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// The first day from today forward with nothing booked. Walks the taken set
// rather than "max + 1" so days freed by unscheduling get refilled.
export async function nextFreeShootDate(clinicId: string): Promise<string> {
  const supabase = createServerClient()
  const today = boardToday()
  const { data } = await supabase
    .from('studio_videos')
    .select('shoot_date')
    .eq('clinic_id', clinicId)
    .gte('shoot_date', today)
  const taken = new Set(
    (data ?? [])
      .map((r) => r.shoot_date)
      .filter((d): d is string => Boolean(d))
  )
  let day = today
  // Bounded: a year out means something is wrong, and an unbounded loop
  // here would hang the request.
  for (let i = 0; i < 365; i++) {
    if (!taken.has(day)) return day
    day = addDays(day, 1)
  }
  return day
}

// Pin a video to a day. Omit `date` to take the next open one. Returns the
// day actually assigned, which the caller shows back to the admin.
export async function scheduleStudioVideo(
  id: string,
  clinicId: string,
  date?: string | null
): Promise<{ shootDate: string }> {
  const shootDate = date?.trim() || (await nextFreeShootDate(clinicId))
  const supabase = createServerClient()
  const { error } = await supabase
    .from('studio_videos')
    .update({ shoot_date: shootDate, status: 'shotlist' })
    .eq('id', id)
    .eq('clinic_id', clinicId)
  if (error) {
    // uq_studio_videos_shoot_day — the admin picked a day already booked.
    if (error.code === '23505') {
      throw new Error(`${shootDate} already has a video scheduled`)
    }
    throw new Error(error.message)
  }
  return { shootDate }
}

export async function unscheduleStudioVideo(id: string, clinicId: string): Promise<void> {
  const supabase = createServerClient()
  await supabase
    .from('studio_videos')
    .update({ shoot_date: null })
    .eq('id', id)
    .eq('clinic_id', clinicId)
}

// ------------------------------------------------------------
// Board reading

export interface ShootCard {
  id: string
  shoot_date: string
  shot_type: ShotType
  title: string | null
  style_description: string | null
  account: string | null
  source_url: string | null
  // Exactly one of these carries the player: embeds for reels we never
  // copied, video_url for our own uploads.
  embed_url: string | null
  video_url: string | null
  thumbnail_url: string | null
  beats: { name: string; text: string }[]
  // The generated shoot brief — the whole point of the board.
  steps: string[]
  script_lines: string[]
  topic: string | null
}

interface ScheduledRow extends StudioVideo {
  shoot_date: string | null
  embed_url: string | null
}

// Cards from `from` forward (default: today), soonest first. Pulls each
// video's pinned idea in one extra query rather than N.
export async function listShootBoard(
  clinicId: string,
  opts?: { from?: string; limit?: number }
): Promise<ShootCard[]> {
  const supabase = createServerClient()
  const from = opts?.from ?? boardToday()
  const { data } = await supabase
    .from('studio_videos')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('is_active', true)
    .not('shoot_date', 'is', null)
    .gte('shoot_date', from)
    .order('shoot_date', { ascending: true })
    .limit(opts?.limit ?? 60)

  const rows = (data ?? []) as unknown as ScheduledRow[]
  if (rows.length === 0) return []

  const scriptIds = rows
    .map((r) => r.current_script_id)
    .filter((s): s is string => Boolean(s))
  const ideas = new Map<string, { topic: string; steps: string[]; lines: string[] }>()
  if (scriptIds.length) {
    const { data: scripts } = await supabase
      .from('scripts')
      .select('id, topic, full_script, role_blocks')
      .eq('clinic_id', clinicId)
      .in('id', scriptIds)
    for (const s of (scripts ?? []) as {
      id: string
      topic: string | null
      full_script: string | null
      role_blocks: unknown
    }[]) {
      const raw = s.role_blocks
      let steps: string[] = []
      let lines: string[] = []
      // Same dual shape loadStudioIdea handles: {steps, blocks} on new rows,
      // a bare RoleBlock[] on legacy ones.
      const blocks = Array.isArray(raw)
        ? (raw as { speaker?: string; text?: string }[])
        : raw && typeof raw === 'object'
          ? ((raw as { steps?: unknown; blocks?: unknown }).blocks as
              | { speaker?: string; text?: string }[]
              | undefined) ?? []
          : []
      if (!Array.isArray(raw) && raw && typeof raw === 'object') {
        const st = (raw as { steps?: unknown }).steps
        if (Array.isArray(st)) steps = st as string[]
      }
      lines = blocks
        // Operator blocks are post-production notes — not something the MA
        // reads out or acts on while filming.
        .filter((b) => b.speaker !== 'Operator' && b.text?.trim())
        .map((b) => b.text as string)
      if (lines.length === 0 && s.full_script) lines = [s.full_script]
      ideas.set(s.id, { topic: s.topic ?? '', steps, lines })
    }
  }

  return rows.map((r) => {
    const idea = r.current_script_id ? ideas.get(r.current_script_id) : undefined
    const structure = (r.structure ?? {}) as StudioVideoStructure
    return {
      id: r.id,
      shoot_date: r.shoot_date as string,
      shot_type: (r.shot_type ?? 'doctor') as ShotType,
      title: r.title,
      style_description: r.style_description,
      account: r.author_handle,
      source_url: r.source_url,
      embed_url: r.embed_url,
      video_url: publicUrl(r.video_storage_path),
      thumbnail_url: publicUrl(r.thumbnail_storage_path),
      beats: (structure.beats ?? []).map((b) => ({ name: b.name, text: b.text })),
      steps: idea?.steps ?? [],
      script_lines: idea?.lines ?? [],
      topic: idea?.topic ?? null,
    }
  })
}

// ------------------------------------------------------------
// Share token — deliberately NOT an access_tokens row. Those carry a
// clinic-wide role; this one may only ever open the shoot board.

function newBoardToken(): string {
  return randomBytes(18).toString('base64url')
}

// Idempotent: returns the existing token, minting one on first call.
export async function ensureShootBoardToken(clinicId: string): Promise<string> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('clinics')
    .select('shoot_board_token')
    .eq('id', clinicId)
    .maybeSingle()
  const existing = data?.shoot_board_token
  if (existing) return existing

  const token = newBoardToken()
  const { error } = await supabase
    .from('clinics')
    .update({ shoot_board_token: token })
    .eq('id', clinicId)
  if (error) throw new Error(error.message)
  return token
}

// Invalidates the old link — for when someone leaves the team.
export async function rotateShootBoardToken(clinicId: string): Promise<string> {
  const token = newBoardToken()
  const supabase = createServerClient()
  const { error } = await supabase
    .from('clinics')
    .update({ shoot_board_token: token })
    .eq('id', clinicId)
  if (error) throw new Error(error.message)
  return token
}

export async function clinicByShootBoardToken(
  token: string
): Promise<{ clinicId: string; clinicName: string } | null> {
  const t = token?.trim()
  if (!t) return null
  const supabase = createServerClient()
  const { data } = await supabase
    .from('clinics')
    .select('id, name')
    .eq('shoot_board_token', t)
    .maybeSingle()
  if (!data) return null
  return { clinicId: data.id, clinicName: data.name }
}
