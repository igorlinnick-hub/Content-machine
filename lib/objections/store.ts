import { createServerClient } from '@/lib/supabase/server'

// The objection map, one row per question a patient asks before booking
// (migration 056). Two live runs of the `Patient question` format proved
// why this table has to exist: handed the question as free text in a topic
// hint, the Writer treated it as a theme and wrote a patient story, an
// explainer and a checklist — the answer was in there, but the first line
// was never the question, and a library you cannot look a question up in is
// not what the clinic is sold.
//
// Group numbers follow the method (docs/objection-maps/METHOD.md in the
// Yedino repo): 1 do I even have this · 2 can it be fixed · 3 is it safe ·
// 4 what does it cost and how long · 5 why you and not someone else.
// Clinics answer group 1 and almost never 3-5, which is where the money is.

export type ObjectionState = 'unanswered' | 'answered_unfindable' | 'findable'

export interface Objection {
  id: string
  clinic_id: string
  number: number
  group_no: number
  question: string
  state: ObjectionState
  note: string | null
}

const COLUMNS = 'id, clinic_id, number, group_no, question, state, note'

export async function loadObjection(
  objectionId: string,
  clinicId?: string
): Promise<Objection | null> {
  const supabase = createServerClient()
  let q = supabase.from('clinic_objections').select(COLUMNS).eq('id', objectionId)
  if (clinicId) q = q.eq('clinic_id', clinicId)
  const { data } = await q.maybeSingle()
  return (data as Objection) ?? null
}

export async function listObjections(
  clinicId: string,
  opts: { group?: number; state?: ObjectionState } = {}
): Promise<Objection[]> {
  const supabase = createServerClient()
  let q = supabase
    .from('clinic_objections')
    .select(COLUMNS)
    .eq('clinic_id', clinicId)
    .order('number', { ascending: true })
  if (opts.group) q = q.eq('group_no', opts.group)
  if (opts.state) q = q.eq('state', opts.state)
  const { data } = await q
  return (data ?? []) as Objection[]
}

// The next question worth filming: nothing has answered it yet. "Answered"
// means a script exists for it — findability, not "we mentioned it once".
export async function nextUnansweredObjection(
  clinicId: string
): Promise<Objection | null> {
  const supabase = createServerClient()
  const { data: answered } = await supabase
    .from('scripts')
    .select('objection_id')
    .eq('clinic_id', clinicId)
    .not('objection_id', 'is', null)
  const taken = new Set((answered ?? []).map((r) => r.objection_id as string))
  const all = await listObjections(clinicId)
  return all.find((o) => !taken.has(o.id)) ?? null
}
