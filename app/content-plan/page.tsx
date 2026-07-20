import { redirect } from 'next/navigation'
import { resolveAccess } from '@/lib/auth/session'
import { PageHeader } from '@/app/components/PageHeader'
import { loadStructuredPlan, getCurrentStructuredWeek, pillarColor, type StructuredPlanWeek } from '@/lib/content-plan/store'
import { GeneratePlanButton } from './components/GeneratePlanButton'
import { WeekCard } from './components/WeekCard'

export const dynamic = 'force-dynamic'

export default async function ContentPlanPage({
  searchParams,
}: {
  searchParams: { clinicId?: string }
}) {
  const access = await resolveAccess()
  if (!access) redirect('/')

  const clinicId =
    access.role === 'admin'
      ? searchParams.clinicId ?? ''
      : access.clinicId

  const isAdmin = access.role === 'admin'

  const supabase = (await import('@/lib/supabase/server')).createServerClient()
  const [{ data: clinicMeta }, plan, currentWeek] = await Promise.all([
    clinicId
      ? supabase.from('clinics').select('plan_status, plan_error').eq('id', clinicId).single()
      : Promise.resolve({ data: null }),
    clinicId ? loadStructuredPlan(clinicId) : Promise.resolve([]),
    clinicId ? getCurrentStructuredWeek(clinicId) : Promise.resolve(null),
  ])
  const planStatus = clinicMeta?.plan_status ?? null

  // Compute per-pillar counts from the DB plan
  const pillarCounts = new Map<string, number>()
  for (const week of plan) {
    pillarCounts.set(week.pillar, (pillarCounts.get(week.pillar) ?? 0) + week.posts.length)
  }
  const pillars = Array.from(pillarCounts.entries()).sort((a, b) => b[1] - a[1])

  const isEmpty = plan.length === 0

  return (
    <main className="min-h-screen cm-page-bg">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex items-start justify-between gap-4">
          <PageHeader
            eyebrow="Content Machine · Plan"
            title="Content Plan"
            subtitle={
              isEmpty
                ? 'No plan yet — generate one with AI'
                : `${plan.length}-week cycle · ${plan.reduce((s, w) => s + w.posts.length, 0)} posts · ${pillars.length} pillar${pillars.length !== 1 ? 's' : ''}`
            }
            back={clinicId ? `/dashboard?clinicId=${clinicId}` : '/dashboard'}
          />
          {isAdmin && clinicId && (
            <GeneratePlanButton clinicId={clinicId} initialStatus={planStatus} />
          )}
        </div>

        {/* Empty state */}
        {isEmpty && (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-neutral-200 bg-white/40 px-8 py-12 text-center backdrop-blur">
            <span className="text-4xl">🗓️</span>
            <div>
              <p className="text-base font-semibold text-neutral-800">No content plan yet</p>
              <p className="mt-1 text-sm text-neutral-500">
                Click &ldquo;✨ Generate plan with AI&rdquo; to create an 8-week editorial plan
                tailored to this clinic&apos;s pillars and services.
              </p>
            </div>
          </div>
        )}

        {/* Current week callout */}
        {currentWeek && (() => {
          const color = pillarColor(currentWeek.pillar)
          return (
            <div
              className="flex items-center gap-3 rounded-xl border px-4 py-3"
              style={{
                background: `${color}0d`,
                borderColor: `${color}30`,
              }}
            >
              <span
                className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]"
                style={{
                  background: `${color}20`,
                  color,
                  border: `1px solid ${color}35`,
                }}
              >
                This week
              </span>
              <div className="min-w-0">
                <span className="block text-[13px] font-semibold text-neutral-800">
                  Week {currentWeek.week_number} — {currentWeek.theme}
                </span>
                <span className="block truncate text-[11px] text-neutral-500">{currentWeek.pillar}</span>
              </div>
            </div>
          )
        })()}

        {/* Pillar legend */}
        {pillars.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {pillars.map(([pillar, count]) => {
              const color = pillarColor(pillar)
              return (
                <div
                  key={pillar}
                  className="flex flex-col gap-1.5 rounded-xl border p-3"
                  style={{ background: `${color}0d`, borderColor: `${color}30` }}
                >
                  <span className="line-clamp-2 text-[10px] font-bold uppercase leading-[1.4] tracking-[0.12em]" style={{ color }}>
                    {pillar}
                  </span>
                  <span className="text-xl font-bold text-neutral-900">{count}</span>
                  <span className="text-[11px] text-neutral-500">{count} post{count !== 1 ? 's' : ''}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Week grid */}
        {plan.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {plan.map((week) => (
              <WeekCard
                key={week.id}
                week={week}
                clinicId={clinicId}
                isCurrent={currentWeek?.id === week.id}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
