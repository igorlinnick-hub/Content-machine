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
    .select('doctor_name, services, content_pillars')
    .eq('id', clinic.id)
    .single()

  const questions = getDailyQuestions()
  const recent = await loadRecentScripts(clinic.id, 5)

  const services = clinicRow?.services ?? []
  const pillars = clinicRow?.content_pillars ?? []

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-8 sm:px-6 sm:py-10">
        <header className="flex flex-col gap-4 border-b border-neutral-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-orange-500">
              Content Machine
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-neutral-900 sm:text-4xl">
              {clinic.name}
            </h1>
            {clinicRow?.doctor_name && (
              <p className="mt-1 text-base text-neutral-600">
                {clinicRow.doctor_name}
              </p>
            )}
            {(services.length > 0 || pillars.length > 0) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {services.slice(0, 4).map((s) => (
                  <span
                    key={`svc-${s}`}
                    className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs text-neutral-700"
                  >
                    {s}
                  </span>
                ))}
                {pillars.slice(0, 3).map((p) => (
                  <span
                    key={`pil-${p}`}
                    className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs text-orange-700"
                  >
                    {p}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {clinics.length > 1 && (
              <nav className="flex flex-wrap gap-1.5">
                {clinics.map((c) => (
                  <Link
                    key={c.id}
                    href={`/dashboard?clinicId=${c.id}`}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      c.id === clinic.id
                        ? 'bg-neutral-900 text-white'
                        : 'border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    {c.name}
                  </Link>
                ))}
              </nav>
            )}
            <Link
              href="/onboarding"
              className="cm-btn cm-btn-ghost text-sm"
            >
              Retake quiz
            </Link>
          </div>
        </header>

        <Section
          number={1}
          title="Today's questions"
          subtitle="Quick answers feed the agents. 30 seconds each."
        >
          <DailyWidgets clinicId={clinic.id} questions={questions} />
        </Section>

        <Section
          number={2}
          title="Generate scripts"
          subtitle="Three variants per round. Pick the one that sounds like you — the writer learns from every choice."
        >
          <ScriptGenerator clinicId={clinic.id} />
        </Section>

        <Section
          number={3}
          title="Recent scripts"
          subtitle="Your last 5 approved or saved scripts."
        >
          <RecentScripts scripts={recent} />
        </Section>

        <footer className="pt-2 text-center text-xs text-neutral-400">
          Content Machine · regen-med
        </footer>
      </div>
    </main>
  )
}

function Section({
  number,
  title,
  subtitle,
  children,
}: {
  number: number
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-500 text-xs font-semibold text-white">
          {number}
        </span>
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">{title}</h2>
          <p className="mt-0.5 text-sm text-neutral-600">{subtitle}</p>
        </div>
      </div>
      <div>{children}</div>
    </section>
  )
}
