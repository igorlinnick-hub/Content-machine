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
import { PWAInstallCard } from './components/PWAInstallCard'
import { Logomark } from '@/app/components/Logomark'
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
  const isDoctor = access.role !== 'admin'
  const doctorDisplayName =
    (isDoctor && access.doctorName) || clinicRow.doctor_name || null

  const headline = isDoctor
    ? doctorDisplayName
      ? `Hi, ${doctorDisplayName} 👋`
      : 'Welcome 👋'
    : clinicName

  const subline = isDoctor
    ? clinicName
    : clinicRow.doctor_name || null

  const profileIncomplete = services.length === 0 || pillars.length === 0

  return (
    <main className="min-h-screen bg-white">
      <TokenBootstrap />
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-8 sm:px-6 sm:py-10 cm-fade-in">
        <header className="flex flex-col gap-4 border-b border-neutral-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-sky-500">
              <Logomark size={18} />
              Content Machine
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-neutral-900 sm:text-4xl">
              {headline}
            </h1>
            {subline && (
              <p className="mt-1 text-base text-neutral-600">{subline}</p>
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
                    className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs text-sky-700"
                  >
                    {p}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Compact top-right: role badge only. The clinic switcher and
              section nav live in their own rows below the headline so
              "WHICH clinic" and "WHERE to go" stop competing for the
              same eye-line. */}
          <RoleBadge
            role={access.role}
            doctorName={isDoctor ? doctorDisplayName : null}
          />
        </header>

        {/* Admin secondary nav — clinic switcher (one row) + section
            jumps (separate row). Doctors don't see this; they're
            pinned to their one clinic. */}
        {showAdminTools && (
          <nav className="flex flex-col gap-3 -mt-4 border-b border-neutral-200 pb-5">
            {clinics.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Clinic
                </span>
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
              </div>
            )}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                Go to
              </span>
              <span className="rounded-lg bg-sky-100 px-3 py-1.5 text-xs font-semibold text-sky-800">
                📝 Posts
              </span>
              <Link
                href={`/arsenal?clinicId=${clinicId}`}
                className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
              >
                🧱 Library
              </Link>
              <Link
                href={`/visual?clinicId=${clinicId}`}
                className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
              >
                🎨 Visual posts
              </Link>
              <Link
                href={`/clinics?clinicId=${clinicId}`}
                className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
              >
                ⚙ Clinics
              </Link>
            </div>
          </nav>
        )}

        <section className="flex flex-col gap-4 rounded-2xl border border-sky-200 bg-sky-50 p-6 shadow-sm sm:p-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">
              Main workspace
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-neutral-900">
              Generate scripts
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              Leave the topic blank to let your team pick from your pillars, or type a specific topic. Three variants every time.
            </p>
          </div>
          <ScriptGenerator clinicId={clinicId} />
        </section>

        {showAdminTools && (
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Link
              href={`/arsenal?clinicId=${clinicId}`}
              className="cm-card flex flex-col gap-1 p-5 transition hover:border-sky-300 hover:shadow-md"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-500">
                🧱 Library
              </p>
              <h3 className="text-base font-semibold text-neutral-900">
                Reference arsenal + templates →
              </h3>
              <p className="text-sm text-neutral-600">
                Drop a video, get a clinic-tailored template. Edit scaffolds the
                writer borrows from.
              </p>
            </Link>
            <Link
              href={`/visual?clinicId=${clinicId}`}
              className="cm-card flex flex-col gap-1 p-5 transition hover:border-sky-300 hover:shadow-md"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-500">
                🎨 Visual posts
              </p>
              <h3 className="text-base font-semibold text-neutral-900">
                Rendered slides, topics & references →
              </h3>
              <p className="text-sm text-neutral-600">
                Topics list, golden scripts, golden post references (PNG),
                categories, slide editor.
              </p>
            </Link>
            <Link
              href={`/clinics?clinicId=${clinicId}`}
              className="cm-card flex flex-col gap-1 p-5 transition hover:border-sky-300 hover:shadow-md"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-500">
                ⚙ Clinics
              </p>
              <h3 className="text-base font-semibold text-neutral-900">
                Profile, brand & install links →
              </h3>
              <p className="text-sm text-neutral-600">
                Edit who the writer thinks this clinic is. Logo on every slide.
                Onboard a new clinic.
              </p>
            </Link>
          </section>
        )}

        {isDoctor && profileIncomplete && (
          <Link
            href="/onboarding"
            className="cm-card flex items-center justify-between gap-4 p-5 transition hover:border-sky-300 hover:shadow-md"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-500">
                First step
              </p>
              <h3 className="mt-1 text-lg font-semibold text-neutral-900">
                Finish setting up your profile
              </h3>
              <p className="mt-1 text-sm text-neutral-600">
                Takes ~4 minutes. Your AI team needs this to write in your voice.
              </p>
            </div>
            <span className="cm-btn cm-btn-primary shrink-0 text-sm">
              Take the quiz →
            </span>
          </Link>
        )}

        <Section
          title="Today's input"
          subtitle="Three quick prompts plus an open note — 1–2 minutes total. Your answers feed the writer, so it sounds like you tomorrow."
        >
          <div className="flex flex-col gap-5">
            <DailyWidgets clinicId={clinicId} questions={questions} />
          </div>
        </Section>

        <Section
          title="Recent scripts"
          subtitle="Your last 5 saved scripts. Tap any to copy or post."
        >
          <RecentScripts scripts={recent} />
        </Section>

        <PWAInstallCard />

        <footer className="pt-2 text-center text-xs text-neutral-400">
          Content Machine · regen-med
        </footer>
      </div>
    </main>
  )
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">{title}</h2>
        <p className="mt-1 text-sm text-neutral-600">{subtitle}</p>
      </div>
      <div>{children}</div>
    </section>
  )
}
