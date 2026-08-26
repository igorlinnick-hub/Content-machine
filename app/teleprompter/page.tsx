import { redirect } from 'next/navigation'
import { resolveAccess } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import { TeleprompterView } from './components/TeleprompterView'
import { spokenScript } from '@/lib/posts/spoken'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Teleprompter — Content Machine' }

interface PageProps {
  searchParams: { clinicId?: string; scriptId?: string }
}

export default async function TeleprompterPage({ searchParams }: PageProps) {
  const access = await resolveAccess()
  if (!access) redirect('/')

  const clinicId =
    access.role === 'admin'
      ? searchParams.clinicId ?? ''
      : access.clinicId

  const initialScriptId = searchParams.scriptId ?? null

  if (!clinicId) redirect('/dashboard')

  const supabase = createServerClient()

  const SCRIPT_FIELDS = 'id, topic, full_script, created_at, critic_score, starred'
  const LEGACY_FIELDS = 'id, topic, full_script, created_at, critic_score'

  // The doctor's list is the shortlist the marketing team starred, not the
  // whole archive — 30 rows of variants on a phone is why she taps blind.
  // Admin (and admin previewing a clinic) still sees everything.
  const starredOnly = access.role !== 'admin'

  async function loadScripts() {
    let q = supabase
      .from('scripts')
      .select(SCRIPT_FIELDS)
      .eq('clinic_id', clinicId)
      .not('full_script', 'is', null)
    if (starredOnly) q = q.eq('starred', true)

    const res = await q.order('created_at', { ascending: false }).limit(30)
    if (!res.error) return res.data ?? []

    // Pre-046 database: no `starred` column. An unfiltered list beats
    // handing the doctor an empty teleprompter.
    const legacy = await supabase
      .from('scripts')
      .select(LEGACY_FIELDS)
      .eq('clinic_id', clinicId)
      .not('full_script', 'is', null)
      .order('created_at', { ascending: false })
      .limit(30)
    return legacy.data ?? []
  }

  const [{ data: clinic }, scripts] = await Promise.all([
    supabase
      .from('clinics')
      .select('name, full_name')
      .eq('id', clinicId)
      .single(),
    loadScripts(),
  ])

  if (!clinic) redirect('/dashboard')

  // "Teleprompter →" deep-link: the clicked script may have been
  // pushed out of the recent window (one generation = 5-6 variants) —
  // fetch it explicitly so the doctor never lands on an empty prompt.
  let rows = scripts ?? []
  if (initialScriptId && !rows.some((s) => s.id === initialScriptId)) {
    const byId = await supabase
      .from('scripts')
      .select(SCRIPT_FIELDS)
      .eq('id', initialScriptId)
      .eq('clinic_id', clinicId)
      .maybeSingle()
    const one = byId.error
      ? (
          await supabase
            .from('scripts')
            .select(LEGACY_FIELDS)
            .eq('id', initialScriptId)
            .eq('clinic_id', clinicId)
            .maybeSingle()
        ).data
      : byId.data
    if (one?.full_script) rows = [one, ...rows]
  }

  return (
    <main className="min-h-screen cm-page-bg">
      <TeleprompterView
        clinicId={clinicId}
        clinicName={clinic.full_name ?? clinic.name}
        initialScriptId={initialScriptId}
        recentScripts={rows.map((s) => ({
          id: s.id,
          title: s.topic ?? 'Untitled',
          // Strip CTA-stack notation + SOURCES — markup, not speech.
          body: spokenScript(s.full_script ?? ''),
          created_at: (s as { created_at?: string | null }).created_at ?? null,
          critic_score: (s as { critic_score?: number | null }).critic_score ?? null,
          starred: (s as { starred?: boolean | null }).starred ?? false,
        }))}
      />
    </main>
  )
}
