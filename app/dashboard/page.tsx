import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { loadClinicList, loadClinicSummaries, loadRecentScripts } from '@/lib/supabase/context'
import { loadScriptTemplates } from '@/lib/posts/templates'
import { getDailyQuestions } from '@/lib/widgets/questions'
import { resolveAccess } from '@/lib/auth/session'
import { DailyWidgets } from './components/DailyWidgets'
import { ScriptGenerator } from './components/ScriptGenerator'
import { RecentScripts } from './components/RecentScripts'
import { TokenBootstrap } from './components/TokenBootstrap'
import { PWAInstallCard } from './components/PWAInstallCard'
import { DashBento } from './components/DashBento'
import { AdminOverview } from './components/AdminOverview'
import { Logomark } from '@/app/components/Logomark'
import { RoleBadge } from '@/app/components/RoleBadge'
import { AdminPreviewBanner } from '@/app/components/AdminPreviewBanner'
import { BorderBeam } from '@/app/components/ui/border-beam'
import { AnimatedGradientText } from '@/app/components/ui/animated-gradient-text'
import { AnimatedShinyText } from '@/app/components/ui/animated-shiny-text'
import { DiaTextReveal } from '@/app/components/ui/dia-text-reveal'
import { NumberTicker } from '@/app/components/ui/number-ticker'

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

  // Admin without clinicId → show overview
  const isAdminOverview = access.role === 'admin' && !searchParams.clinicId

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
  const [recent, activeTemplates, clinicSummaries] = await Promise.all([
    loadRecentScripts(clinicId, 15),
    loadScriptTemplates(clinicId, { activeOnly: true }),
    isAdminOverview ? loadClinicSummaries() : Promise.resolve([]),
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

  const ADMIN_NAME = process.env.ADMIN_DISPLAY_NAME ?? 'Igor'

  const headline = isDoctor ? clinicName : `Welcome, ${ADMIN_NAME}`

  const subline = isDoctor
    ? doctorDisplayName
      ? `Welcome, ${doctorDisplayName}`
      : 'Welcome'
    : null

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
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">

        {/* ── Hero header — glass ───────────────────────────────────── */}
        <header
          className="relative overflow-hidden rounded-2xl"
          style={{
            background: 'rgba(255,255,255,0.62)',
            backdropFilter: 'blur(32px) saturate(1.8)',
            WebkitBackdropFilter: 'blur(32px) saturate(1.8)',
            border: '1px solid rgba(255,255,255,0.80)',
            boxShadow: '0 4px 32px rgba(0,0,0,0.07), 0 1px 0 rgba(255,255,255,0.95) inset',
          }}
        >
          <BorderBeam colorFrom="#38bdf8" colorTo="#a78bfa" duration={5} bg="rgba(255,255,255,0.62)" />

          <div className="relative z-10 flex flex-col gap-4 px-6 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-8">
            <div className="min-w-0">
              <p
                className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-500 cm-rise"
                style={{ animationDelay: '0ms' }}
              >
                <Logomark size={16} />
                <AnimatedShinyText shimmerWidth={120} className="text-sky-500">
                  Content Machine
                </AnimatedShinyText>
              </p>
              <h1
                className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl cm-rise"
                style={{ animationDelay: '90ms' }}
              >
                <AnimatedGradientText colorFrom="#0ea5e9" colorVia="#7c3aed" colorTo="#0d9488">
                  {headline}
                </AnimatedGradientText>
              </h1>
              {subline && (
                <p
                  className="mt-2 text-base font-medium text-neutral-500 cm-rise"
                  style={{ animationDelay: '180ms' }}
                >
                  <DiaTextReveal
                    text={subline}
                    textColor="#6b7280"
                    duration={1.2}
                    delay={0.3}
                  />
                </p>
              )}
            </div>

            <div
              className="flex shrink-0 items-center gap-2 cm-rise"
              style={{ animationDelay: '240ms' }}
            >
              <Link
                href="/compliance"
                className="rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-xs font-semibold text-amber-600 transition hover:bg-amber-100"
                title="FDA / FTC ruleset that every post is scored against"
              >
                Compliance
              </Link>
              <RoleBadge
                role={access.role}
                doctorName={isDoctor ? doctorDisplayName : null}
                variant="light"
              />
            </div>
          </div>
        </header>

        {/* Admin clinic switcher (compact) — only when viewing a specific clinic */}
        {showAdminTools && !isAdminOverview && clinics.length > 1 && (
          <nav className="flex flex-wrap items-center gap-1.5">
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
          </nav>
        )}

        {/* Admin overview — clinic cards */}
        {isAdminOverview && <AdminOverview clinics={clinicSummaries} />}

        {/* Bento overview grid */}
        {!isAdminOverview && <DashBento clinicId={clinicId} isAdmin={showAdminTools} />}

        {/* Main tab bar — hidden on admin overview */}
        {!isAdminOverview && <nav className="flex flex-wrap items-center gap-1 rounded-2xl p-1"
          style={{
            background: 'rgba(255,255,255,0.55)',
            backdropFilter: 'blur(20px) saturate(1.8)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
            border: '1px solid rgba(255,255,255,0.70)',
            boxShadow: '0 2px 16px rgba(0,0,0,0.05)',
          }}
        >
          <DashTabLink
            label="Generate"
            href={`/dashboard?clinicId=${clinicId}&tab=generate`}
            active={tab === 'generate'}
          />
          <DashTabLink
            label={
              <span className="inline-flex items-center">
                {'Recent ('}
                <NumberTicker value={recent.length} />
                {')'}
              </span>
            }
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
              className="ml-auto rounded-xl px-4 py-1.5 text-sm font-medium text-sky-600 transition hover:bg-white/60"
            >
              Studio
            </Link>
          ) : (
            <Link
              href="/install"
              className="ml-auto rounded-xl px-4 py-1.5 text-sm font-medium text-neutral-500 transition hover:bg-white/60"
            >
              Install
            </Link>
          )}
        </nav>}

        {!isAdminOverview && isDoctor && profileIncomplete && tab === 'generate' && (
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

        {!isAdminOverview && tab === 'generate' && (
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

        {!isAdminOverview && tab === 'recent' && (
          <Section
            title="Recent scripts"
            subtitle="Every script Writer has saved for this clinic. Tap any to read, copy, or post."
          >
            <RecentScripts scripts={recent} />
          </Section>
        )}

        {!isAdminOverview && tab === 'input' && (
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
  label: React.ReactNode
  href: string
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={`relative rounded-xl px-4 py-1.5 text-sm font-medium transition-all duration-200 overflow-hidden ${
        active
          ? 'bg-neutral-900/90 text-white shadow-sm'
          : 'text-neutral-500 hover:bg-white/70 hover:text-neutral-700'
      }`}
    >
      {label}
      {active && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-xl"
          style={{
            background: 'linear-gradient(to right, #38bdf820, #a78bfa20, #2dd4bf20)',
            backgroundSize: '200% 100%',
            animation: 'gradient 4s linear infinite',
          }}
        />
      )}
    </Link>
  )
}
