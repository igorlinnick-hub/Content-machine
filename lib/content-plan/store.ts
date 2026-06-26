import { createServerClient } from '@/lib/supabase/server'
import type { PlanContext } from '@/types'

export interface StructuredPlanPost {
  id: string           // content_plan_topics.id
  topic: string
  keyword: string | null
  position: number
  status: 'pending' | 'done' | 'skipped'
}

export interface StructuredPlanWeek {
  id: string           // content_plan_weeks.id
  week_number: number
  theme: string
  pillar: string
  description: string | null
  position: number
  posts: StructuredPlanPost[]
}

// Deterministic pillar → color. Known 4 keep legacy values; extras get a
// hash into a small palette so new niches still get a consistent colour.
const KNOWN_COLORS: Record<string, string> = {
  'Mental Health':       '#0EA5E9',
  'Pain & Joint':        '#B45309',
  'Wellness & Vitality': '#0F766E',
  'Weight Loss':         '#A855F7',
}
const FALLBACK_PALETTE = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6', '#14B8A6']

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff
  return Math.abs(h)
}

export function pillarColor(pillar: string): string {
  return KNOWN_COLORS[pillar] ?? FALLBACK_PALETTE[hashStr(pillar) % FALLBACK_PALETTE.length]
}

export async function loadStructuredPlan(clinicId: string): Promise<StructuredPlanWeek[]> {
  const supabase = createServerClient()

  const { data: weeks, error: weeksErr } = await supabase
    .from('content_plan_weeks')
    .select('id, week_number, theme, pillar, description, position')
    .eq('clinic_id', clinicId)
    .order('position', { ascending: true })
    .order('week_number', { ascending: true })

  if (weeksErr) throw weeksErr
  if (!weeks || weeks.length === 0) return []

  const weekIds = weeks.map((w) => w.id)

  const { data: topics, error: topicsErr } = await supabase
    .from('content_plan_topics')
    .select('id, week_id, topic, keyword, position, status')
    .in('week_id', weekIds)
    .order('position', { ascending: true })

  if (topicsErr) throw topicsErr

  const topicsByWeek = new Map<string, StructuredPlanPost[]>()
  for (const t of topics ?? []) {
    if (!t.week_id) continue
    if (!topicsByWeek.has(t.week_id)) topicsByWeek.set(t.week_id, [])
    topicsByWeek.get(t.week_id)!.push({
      id: t.id,
      topic: t.topic,
      keyword: t.keyword ?? null,
      position: t.position,
      status: (t.status ?? 'pending') as StructuredPlanPost['status'],
    })
  }

  return weeks.map((w) => ({
    id: w.id,
    week_number: w.week_number,
    theme: w.theme,
    pillar: w.pillar,
    description: w.description ?? null,
    position: w.position,
    posts: topicsByWeek.get(w.id) ?? [],
  }))
}

export async function getCurrentStructuredWeek(clinicId: string): Promise<StructuredPlanWeek | null> {
  const plan = await loadStructuredPlan(clinicId)
  if (plan.length === 0) return null

  const supabase = createServerClient()
  const { data: clinic } = await supabase
    .from('clinics')
    .select('content_plan_start')
    .eq('id', clinicId)
    .single()

  const startStr = clinic?.content_plan_start ?? '2026-06-01'
  const start = new Date(startStr + 'T00:00:00Z')
  const now = new Date()
  const daysSince = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86_400_000))
  const weekIndex = Math.floor(daysSince / 7) % plan.length

  return plan[weekIndex]
}

export async function getCurrentPlanContext(
  clinicId: string,
  topicId?: string
): Promise<PlanContext | null> {
  const supabase = createServerClient()

  if (topicId) {
    // Specific topic → join to its week
    const { data } = await supabase
      .from('content_plan_topics')
      .select('id, topic, keyword, week_id, content_plan_weeks(week_number, theme, pillar)')
      .eq('id', topicId)
      .maybeSingle()

    if (!data || !data.week_id) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const week = (data as any).content_plan_weeks as { week_number: number; theme: string; pillar: string } | null
    if (!week) return null

    return {
      week_number: week.week_number,
      theme: week.theme,
      pillar: week.pillar,
      keyword: data.keyword ?? null,
      topic: data.topic,
    }
  }

  // Default: current week's first pending topic
  const currentWeek = await getCurrentStructuredWeek(clinicId)
  if (!currentWeek) return null

  const firstPost = currentWeek.posts.find((p) => p.status === 'pending') ?? currentWeek.posts[0]
  if (!firstPost) return null

  return {
    week_number: currentWeek.week_number,
    theme: currentWeek.theme,
    pillar: currentWeek.pillar,
    keyword: firstPost.keyword,
    topic: firstPost.topic,
  }
}

export interface ReplaceWeekInput {
  week_number: number
  theme: string
  pillar: string
  description?: string | null
  posts: Array<{ topic: string; keyword?: string | null }>
}

export async function replaceStructuredPlan(
  clinicId: string,
  weeks: ReplaceWeekInput[]
): Promise<void> {
  const supabase = createServerClient()

  // Delete existing weeks — ON DELETE CASCADE removes linked topics (week_id set).
  // Orphaned topics (week_id = null, used by cron/posts-pipeline) are untouched.
  await supabase.from('content_plan_weeks').delete().eq('clinic_id', clinicId)

  if (weeks.length === 0) return

  const { data: insertedWeeks, error: weeksErr } = await supabase
    .from('content_plan_weeks')
    .insert(
      weeks.map((w, i) => ({
        clinic_id: clinicId,
        week_number: w.week_number,
        theme: w.theme,
        pillar: w.pillar,
        description: w.description ?? null,
        position: i,
      }))
    )
    .select('id, week_number')

  if (weeksErr) throw weeksErr
  if (!insertedWeeks) return

  const weekIdMap = new Map(insertedWeeks.map((w) => [w.week_number, w.id]))

  const topicsToInsert: Array<{
    clinic_id: string
    week_id: string
    topic: string
    keyword: string | null
    position: number
    status: 'pending'
  }> = []

  for (const w of weeks) {
    const weekId = weekIdMap.get(w.week_number)
    if (!weekId) continue
    w.posts.forEach((p, i) => {
      topicsToInsert.push({
        clinic_id: clinicId,
        week_id: weekId,
        topic: p.topic,
        keyword: p.keyword ?? null,
        position: i,
        status: 'pending',
      })
    })
  }

  if (topicsToInsert.length > 0) {
    const { error: topicsErr } = await supabase
      .from('content_plan_topics')
      .insert(topicsToInsert)
    if (topicsErr) throw topicsErr
  }
}
