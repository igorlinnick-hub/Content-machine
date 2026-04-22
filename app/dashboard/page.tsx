import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { loadClinicList, loadRecentScripts } from '@/lib/supabase/context'
import { getDailyQuestions } from '@/lib/widgets/questions'
import { DailyWidgets } from './components/DailyWidgets'
import { ScriptGenerator } from './components/ScriptGenerator'
import { RecentScripts } from './components/RecentScripts'

export const dynamic = 'force-dynamic'

interface DashboardPageProps {
  searchParams: { clinicId?: string }
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const clinics = await loadClinicList()
  if (clinics.length === 0) redirect('/onboarding')

  const clinicId = searchParams.clinicId ?? clinics[0].id
  const clinic = clinics.find((c) => c.id === clinicId) ?? clinics[0]

  const supabase = createServerClient()
  const { data: clinicRow } = await supabase
    .from('clinics')
    .select('doctor_name, tone, audience, services')
    .eq('id', clinic.id)
    .single()

  const questions = getDailyQuestions()
  const recent = await loadRecentScripts(clinic.id, 10)

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-10 px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{clinic.name}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {clinicRow?.doctor_name ? `${clinicRow.doctor_name} · ` : ''}
            tone: {clinicRow?.tone ?? 'educational'}
            {clinicRow?.audience ? ` · ${clinicRow.audience}` : ''}
          </p>
        </div>
        {clinics.length > 1 && (
          <nav className="flex flex-wrap gap-2 text-xs">
            {clinics.map((c) => (
              <Link
                key={c.id}
                href={`/dashboard?clinicId=${c.id}`}
                className={`rounded border px-2 py-1 ${
                  c.id === clinic.id
                    ? 'border-neutral-900 bg-neutral-900 text-white'
                    : 'border-neutral-300 text-neutral-700'
                }`}
              >
                {c.name}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Today&apos;s questions</h2>
        <DailyWidgets clinicId={clinic.id} questions={questions} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Generate scripts</h2>
        <ScriptGenerator clinicId={clinic.id} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Recent scripts</h2>
        <RecentScripts scripts={recent} />
      </section>
    </main>
  )
}
