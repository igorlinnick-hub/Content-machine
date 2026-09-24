import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { loadClinicList, loadRecentScripts } from '@/lib/supabase/context'
import { getDailyQuestions } from '@/lib/widgets/questions'
import { getCurrentStructuredWeek, loadStructuredPlan } from '@/lib/content-plan/store'
import { resolveAccess } from '@/lib/auth/session'
import { DailyWidgets } from '@/app/dashboard/components/DailyWidgets'
import { ScriptGenerator } from '@/app/dashboard/components/ScriptGenerator'
import { RecentScripts } from '@/app/dashboard/components/RecentScripts'
import { PageHeader } from '@/app/components/PageHeader'
import { NotesWorkspace } from '@/app/scripts/components/NotesWorkspace'
import { NumberTicker } from '@/app/components/ui/number-ticker'

export const dynamic = 'force-dynamic'

type ScriptsTab = 'generate' | 'recent' | 'input' | 'notes'

interface ScriptsPageProps {
  searchParams: {
    clinicId?: string
    tab?: ScriptsTab
  }
}

export default async function ScriptsPage({ searchParams }: ScriptsPageProps) {
  const access = await resolveAccess()
  if (!access) redirect('/')

  // Admin picks a clinic on the dashboard first; doctors are pinned.
  let clinicId: string
  if (access.role === 'admin') {
    if (!searchParams.clinicId) {
      const clinics = await loadClinicList()
      if (clinics.length === 0) redirect('/onboarding')
      const keepTab = searchParams.tab ? `&tab=${searchParams.tab}` : ''
      redirect(`/scripts?clinicId=${clinics[0].id}${keepTab}`)
    }
    clinicId = searchParams.clinicId
  } else {
    clinicId = access.clinicId
  }

  const supabase = createServerClient()
  const { data: clinicRow } = await supabase
    .from('clinics')
    .select('name, services, content_pillars')
    .eq('id', clinicId)
    .single()

  if (!clinicRow) redirect('/dashboard')

  const isAdmin = access.role === 'admin'
  const isDoctor = !isAdmin
  const questions = getDailyQuestions()

  const [currentPlanWeek, planWeeks, recent] = await Promise.all([
    getCurrentStructuredWeek(clinicId),
    loadStructuredPlan(clinicId).catch(() => []),
    // Doctor sees only the starred shortlist; admin sees the archive.
    loadRecentScripts(clinicId, 50, { starredOnly: isDoctor }),
  ])
  const currentWeekIndex = currentPlanWeek
    ? Math.max(0, planWeeks.findIndex((w) => w.id === currentPlanWeek.id))
    : 0

  // Recent is the landing tab: the doctor should see the scripts the
  // marketing team already picked for her, not the generator. 'input' is
  // still reachable by URL (?tab=input) — only its nav button is hidden.
  //
  // Generating is admin-only (Igor 2026-09-10) — we write the scripts, the
  // doctor records the starred ones. ?tab=generate on a doctor session
  // falls back to her list instead of rendering the generator.
  // Notes is for everyone (Igor 2026-09-23): the idea scratchpad next
  // to Generate — dump thoughts typed or photographed off paper, AI
  // fixes mechanics only, never the ideas.
  const validTabs: ScriptsTab[] = isAdmin
    ? ['recent', 'generate', 'notes', 'input']
    : ['recent', 'notes', 'input']
  const tab: ScriptsTab = validTabs.includes(searchParams.tab as ScriptsTab)
    ? (searchParams.tab as ScriptsTab)
    : 'recent'

  const services = clinicRow.services ?? []
  const pillars = clinicRow.content_pillars ?? []
  const profileIncomplete = services.length === 0 || pillars.length === 0
  const starred = recent.filter((s) => s.starred).length

  return (
    <main className="min-h-screen cm-page-bg">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <PageHeader
          eyebrow="Content Machine · Scripts"
          title="Scripts"
          subtitle={
            isDoctor
              ? recent.length === 0
                ? `Nothing to record yet — your marketing team stars the scripts they want you to film.`
                : `${recent.length} to record · ${clinicRow.name}`
              : recent.length === 0
                ? 'Generate your first batch — everything Writer saves lands here.'
                : `${recent.length} saved${starred ? ` · ${starred} starred` : ''} · ${clinicRow.name}`
          }
          back={`/dashboard?clinicId=${clinicId}`}
        />

        <nav
          className="flex flex-wrap items-center gap-1 rounded-2xl p-1"
          style={{
            background: 'rgba(255,255,255,0.55)',
            backdropFilter: 'blur(20px) saturate(1.8)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
            border: '1px solid rgba(255,255,255,0.70)',
            boxShadow: '0 2px 16px rgba(0,0,0,0.05)',
          }}
        >
          <TabLink
            label={
              <span className="inline-flex items-center">
                {'Scripts ('}
                <NumberTicker value={recent.length} />
                {')'}
              </span>
            }
            href={`/scripts?clinicId=${clinicId}&tab=recent`}
            active={tab === 'recent'}
          />
          {isAdmin && (
            <TabLink
              label="Generate"
              href={`/scripts?clinicId=${clinicId}&tab=generate`}
              active={tab === 'generate'}
            />
          )}
          <TabLink
            label="Notes"
            href={`/scripts?clinicId=${clinicId}&tab=notes`}
            active={tab === 'notes'}
          />
          {/* "Today's input" button pulled 2026-08-26 at the clinic's request.
              The tab itself still renders at /scripts?clinicId=…&tab=input —
              re-add this TabLink to bring the button back:
              <TabLink
                label="Today's input"
                href={`/scripts?clinicId=${clinicId}&tab=input`}
                active={tab === 'input'}
              /> */}
        </nav>

        {isDoctor && profileIncomplete && tab !== 'input' && (
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

        {tab === 'generate' && isAdmin && (
          // Phone: slim outer padding so the nested card/strip frames don't
          // stack up into a narrow column. Original ≥sm.
          <section className="flex flex-col gap-4 rounded-2xl border border-sky-200 bg-sky-50 p-3.5 shadow-sm sm:p-7">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">
                Main workspace
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-neutral-900">
                Generate scripts
              </h2>
            </div>
            <ScriptGenerator
              clinicId={clinicId}
              isAdmin={isAdmin}
              planWeeks={planWeeks}
              currentWeekIndex={currentWeekIndex}
              currentWeek={currentPlanWeek}
            />
          </section>
        )}

        {tab === 'recent' && (
          <Section
            title={isDoctor ? 'Your scripts' : 'Recent scripts'}
            subtitle={
              isDoctor
                ? 'The scripts your marketing team picked for you. Tap any to read, edit, or copy.'
                : 'Every script Writer has saved for this clinic. Tap any to read, edit, star, or copy.'
            }
          >
            {/* Only admin toggles the star: it is what puts a script on the
                doctor's list, so she must not be able to unstar herself out
                of her own worklist. */}
            <RecentScripts scripts={recent} clinicId={clinicId} canStar={isAdmin} />
          </Section>
        )}

        {tab === 'notes' && (
          <Section
            title="Notes"
            subtitle="Your idea scratchpad. Dump thoughts in any shape — typed or snapped off paper — and they land here organized. The AI fixes grammar and sorting only; your ideas stay exactly yours."
          >
            <NotesWorkspace clinicId={clinicId} />
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

function TabLink({
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
      className={`relative overflow-hidden rounded-xl px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
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
