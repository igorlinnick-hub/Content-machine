import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { loadClinicList, loadRecentScripts } from '@/lib/supabase/context'
import { getDailyQuestions } from '@/lib/widgets/questions'
import { resolveAccess } from '@/lib/auth/session'
import { DailyWidgets } from './components/DailyWidgets'
import { ScriptGenerator } from './components/ScriptGenerator'
import { RecentScripts } from './components/RecentScripts'
import { TokenBootstrap } from './components/TokenBootstrap'
import { InstallLinkCard } from './components/InstallLinkCard'
import { RoleBadge } from '@/app/components/RoleBadge'

export const dynamic = 'force-dynamic'

interface DashboardPageProps {
  searchParams: { clinicId?: string; cm_bootstrap?: string }
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const access = await resolveAccess()
  if (!access) redirect('/')

  // Doctors are pinned to their clinic. Admin can switch via ?clinicId.
  let clinicId: string
  let clinics: Array<{ id: string; name: string }> = []

  if (access.role === 'admin') {
    clinics = await loadClinicList()
    if (clinics.length === 0) redirect('/onboarding')
    clinicId = searchParams.clinicId ?? clinics[0].id
  } else {
    clinicId = access.clinicId
    clinics = [{ id: clinicId, name: '' }] // placeholder; replaced below
  }

  const supabase = createServerClient()
  const { data: clinicRow } = await supabase
    .from('clinics')
    .select('name, doctor_name, services, content_pillars')
    .eq('id', clinicId)
    .single()

  if (!clinicRow) {
    // clinic was deleted under us — bail to landing
    redirect('/')
  }

  const clinicName = clinicRow.name
  if (access.role !== 'admin') {
    clinics = [{ id: clinicId, name: clinicName }]
  } else {
    clinics = clinics.map((c) => (c.id === clinicId ? { ...c, name: clinicName } : c))
  }

  const questions = getDailyQuestions()
  const recent = await loadRecentScripts(clinicId, 5)

  const services = clinicRow.services ?? []
  const pillars = clinicRow.content_pillars ?? []

  const showAdminTools = access.role === 'admin'

  return (
    <main className="min-h-screen bg-white">
      <TokenBootstrap />
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-8 sm:px-6 sm:py-10">
        <header className="flex flex-col gap-4 border-b border-neutral-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-orange-500">
              Content Machine
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-neutral-900 sm:text-4xl">
              {clinicName}
            </h1>
            {clinicRow.doctor_name && (
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
            {showAdminTools && clinics.length > 1 && (
              <nav className="flex flex-wrap gap-1.5">
                {clinics.map((c) => (
                  <Link
                    key={c.id}
                    href={`/dashboard?clinicId=${c.id}`}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      c.id === clinicId
                        ? 'bg-neutral-900 text-white'
                        : 'border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    {c.name}
                  </Link>
                ))}
              </nav>
            )}
            <Link href="/onboarding" className="cm-btn cm-btn-ghost text-sm">
              Edit profile
            </Link>
            {showAdminTools && (
              <Link href={`/visual?clinicId=${clinicId}`} className="cm-btn cm-btn-ghost text-sm">
                Visual posts →
              </Link>
            )}
            <RoleBadge
              role={access.role}
              doctorName={access.role !== 'admin' ? clinicRow.doctor_name : null}
            />
          </div>
        </header>

        {showAdminTools && <InstallLinkCard clinicId={clinicId} />}

        <Section
          number={1}
          title="Today's questions"
          subtitle="Quick answers feed the agents. 30 seconds each."
        >
          <DailyWidgets clinicId={clinicId} questions={questions} />
        </Section>

        <Section
          number={2}
          title="Generate scripts"
          subtitle="Three variants per round. Pick the one that sounds like you — the writer learns from every choice."
        >
          <ScriptGenerator clinicId={clinicId} />
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
