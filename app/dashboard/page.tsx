import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { loadClinicList, loadRecentScripts } from '@/lib/supabase/context'
import { loadScriptTemplates } from '@/lib/posts/templates'
import { getDailyQuestions } from '@/lib/widgets/questions'
import { resolveAccess } from '@/lib/auth/session'
import { DailyWidgets } from './components/DailyWidgets'
import { ScriptGenerator } from './components/ScriptGenerator'
import { RecentScripts } from './components/RecentScripts'
import { TokenBootstrap } from './components/TokenBootstrap'
import { PWAInstallCard } from './components/PWAInstallCard'
import { HeroBg } from './components/HeroBg'
import { Logomark } from '@/app/components/Logomark'
import { RoleBadge } from '@/app/components/RoleBadge'
import { AdminPreviewBanner } from '@/app/components/AdminPreviewBanner'

export const dynamic = 'force-dynamic'

interface DashboardPageProps {
  searchParams: {
    clinicId?: string
    cm_bootstrap?: string
    tab?: DashTab
  }
}

type DashTab = 'generate' | 'recent' | 'input'

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
  const [recent, activeTemplates] = await Promise.all([
    loadRecentScripts(clinicId, 15),
    loadScriptTemplates(clinicId, { activeOnly: true }),
  ])

  const validTabs: DashTab[] = ['generate', 'recent', 'input']
  const tab: DashTab = validTabs.includes(searchParams.tab as DashTab)
    ? (searchParams.tab as DashTab)
    : 'generate'

  const services = clinicRow.services ?? []
  const pillars = clinicRow.content_pillars ?? []

  const showAdminTools = access.role === 'admin'
  const isDoctor = access.role !== 'admin'
  const doctorDisplayName =
    (isDoctor && access.doctorName) || clinicRow.doctor_name || null

  const headline = isDoctor ? clinicName : clinicName

  const subline = isDoctor
    ? doctorDisplayName
      ? `Welcome, ${doctorDisplayName}`
      : 'Welcome'
    : clinicRow.doctor_name || null

  const profileIncomplete = services.length === 0 || pillars.length === 0

  const isAdminPreview =
    access.role === 'doctor' &&
    'adminPreview' in access &&
    access.adminPreview === true

  return (
    <main className="min-h-screen cm-page-bg">
      {isAdminPreview && (
        <AdminPreviewBanner
          clinicName={clinicName}
          doctorName={doctorDisplayName}
        />
      )}
      <TokenBootstrap />
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-8 sm:px-6 sm:py-10">

        {/* ── Hero header with animated shader ───────────────────────── */}
        <header className="relative overflow-hidden rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.18)]">
          {/* Shader canvas fills the background */}
          <HeroBg className="absolute inset-0 h-full w-full" />

          {/* Content overlay */}
          <div className="relative z-10 flex flex-col gap-4 px-6 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-8">
            <div className="min-w-0">
              <p
                className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-300 cm-rise"
                style={{ animationDelay: '0ms' }}
              >
                <Logomark size={16} />
                Content Machine
              </p>
              <h1
                className="mt-2 text-4xl font-bold tracking-tight text-white sm:text-5xl cm-rise"
                style={{ animationDelay: '90ms' }}
              >
                {headline}
              </h1>
              {subline && (
                <p
                  className="mt-2 text-base font-medium text-white/65 cm-rise"
                  style={{ animationDelay: '180ms' }}
                >
                  {subline}
                </p>
              )}
            </div>

            <div
              className="flex shrink-0 items-center gap-2 cm-rise"
              style={{ animationDelay: '240ms' }}
            >
              <Link
                href="/compliance"
                className="rounded-lg border border-amber-400/40 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-300 backdrop-blur-sm transition hover:bg-amber-400/25"
                title="FDA / FTC ruleset that every post is scored against"
              >
                ⚖️ Compliance
              </Link>
              <div className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur-sm">
                <RoleBadge
                  role={access.role}
                  doctorName={isDoctor ? doctorDisplayName : null}
                />
              </div>
            </div>
          </div>
        </header>

        {/* Admin secondary nav */}
        {showAdminTools && (
          <nav className="flex flex-col gap-3 -mt-4">
            {clinics.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
                  Clinic
                </span>
                {clinics.map((c) => (
                  <Link
                    key={c.id}
                    href={`/dashboard?clinicId=${c.id}`}
                    className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                      c.id === clinicId
                        ? 'bg-neutral-900 text-white shadow-sm'
                        : 'border border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50'
                    }`}
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
                Go to
              </span>
              <span className="rounded-xl bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm">
                📝 Posts
              </span>
              {[
                { href: `/arsenal?clinicId=${clinicId}`, label: '🧱 Library' },
                { href: `/visual?clinicId=${clinicId}`,  label: '🎨 Visual' },
                { href: `/clinics?clinicId=${clinicId}`, label: '⚙ Clinics' },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 transition-all hover:border-neutral-300 hover:bg-neutral-50 hover:shadow-sm"
                >
                  {label}
                </Link>
              ))}
            </div>
          </nav>
        )}

        {/* Main tab bar */}
        <nav className="flex flex-wrap items-center gap-1 rounded-2xl border border-neutral-200 bg-white/70 p-1 shadow-sm backdrop-blur-sm -mt-4">
          <DashTabLink
            label="Generate"
            href={`/dashboard?clinicId=${clinicId}&tab=generate`}
            active={tab === 'generate'}
          />
          <DashTabLink
            label={`Recent (${recent.length})`}
            href={`/dashboard?clinicId=${clinicId}&tab=recent`}
            active={tab === 'recent'}
          />
          <DashTabLink
            label="Today's input"
            href={`/dashboard?clinicId=${clinicId}&tab=input`}
            active={tab === 'input'}
          />
          {showAdminTools ? (
            <Link
              href={`/studio?clinicId=${clinicId}`}
              className="ml-auto rounded-xl border border-sky-200 bg-sky-50 px-4 py-1.5 text-sm font-medium text-sky-700 transition hover:bg-sky-100"
            >
              🎬 Studio
            </Link>
          ) : (
            <Link
              href="/install"
              className="ml-auto rounded-xl border border-neutral-200 px-4 py-1.5 text-sm font-medium text-neutral-500 transition hover:bg-neutral-50"
            >
              📲 Install
            </Link>
          )}
        </nav>

        {isDoctor && profileIncomplete && tab === 'generate' && (
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

        {tab === 'generate' && (
          <section className="flex flex-col gap-4 rounded-2xl border border-sky-200 bg-sky-50 p-6 shadow-sm sm:p-7">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">
                Main workspace
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-neutral-900">
                Generate scripts
              </h2>
            </div>
            <ScriptGenerator clinicId={clinicId} isAdmin={showAdminTools} />

          </section>
        )}

        {tab === 'recent' && (
          <Section
            title="Recent scripts"
            subtitle="Every script Writer has saved for this clinic. Tap any to read, copy, or post."
          >
            <RecentScripts scripts={recent} />
          </Section>
        )}

        {tab === 'input' && (
          <Section
            title="Today's input"
            subtitle="Answer a few questions to give your scripts your personal touch."
          >
            <DailyWidgets clinicId={clinicId} questions={questions} />
          </Section>
        )}

        <PWAInstallCard clinicId={clinicId} isAdmin={showAdminTools} />

        <footer className="pb-2 pt-4 text-center text-xs text-neutral-400">
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

function DashTabLink({
  label,
  href,
  active,
}: {
  label: string
  href: string
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={`rounded-xl px-4 py-1.5 text-sm font-medium transition-all duration-150 ${
        active
          ? 'bg-neutral-900 text-white shadow-sm'
          : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700'
      }`}
    >
      {label}
    </Link>
  )
}
