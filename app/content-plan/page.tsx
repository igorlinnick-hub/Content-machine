import { redirect } from 'next/navigation'
import { resolveAccess } from '@/lib/auth/session'
import { PageHeader } from '@/app/components/PageHeader'
import { PLAN, PILLAR_COLOR, getCurrentPlanWeek, type PlanWeek, type Pillar } from '@/lib/content-plan'

export const dynamic = 'force-dynamic'

const PILLARS: { name: Pillar; count: number; posts: string }[] = [
  { name: 'Mental Health',       count: 9, posts: 'Posts 01-03, 13-15, 19-21' },
  { name: 'Pain & Joint',        count: 4, posts: 'Posts 07-09, 22'            },
  { name: 'Wellness & Vitality', count: 7, posts: 'Posts 04-06, 16-18, 24'    },
  { name: 'Weight Loss',         count: 4, posts: 'Posts 10-12, 23'            },
]

export default async function ContentPlanPage({
  searchParams,
}: {
  searchParams: { clinicId?: string }
}) {
  const access = await resolveAccess()
  if (!access) redirect('/')

  const clinicId =
    access.role === 'admin' ? searchParams.clinicId ?? '' : access.clinicId

  const currentWeek = getCurrentPlanWeek()

  return (
    <main className="min-h-screen cm-page-bg">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
        <PageHeader
          eyebrow="Content Machine · Plan"
          title="Content Plan"
          subtitle="8-week carousel cycle · 24 posts · 3 per week · 4 pillars"
          back={clinicId ? `/dashboard?clinicId=${clinicId}` : '/dashboard'}
        />

        {/* Current week callout */}
        <div
          className="flex items-center gap-3 rounded-xl border px-4 py-3"
          style={{
            background: `${PILLAR_COLOR[currentWeek.pillar]}0d`,
            borderColor: `${PILLAR_COLOR[currentWeek.pillar]}30`,
          }}
        >
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]"
            style={{
              background: `${PILLAR_COLOR[currentWeek.pillar]}20`,
              color: PILLAR_COLOR[currentWeek.pillar],
              border: `1px solid ${PILLAR_COLOR[currentWeek.pillar]}35`,
            }}
          >
            This week
          </span>
          <span className="text-[13px] font-semibold text-neutral-800">
            Week {currentWeek.week} — {currentWeek.theme}
          </span>
          <span className="text-[13px] text-neutral-500">{currentWeek.pillar}</span>
        </div>

        {/* Pillar legend */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PILLARS.map((p) => {
            const color = PILLAR_COLOR[p.name]
            return (
              <div
                key={p.name}
                className="flex flex-col gap-1 rounded-xl border p-3"
                style={{ background: `${color}0d`, borderColor: `${color}30` }}
              >
                <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color }}>
                  {p.name}
                </span>
                <span className="text-xl font-bold text-neutral-900">{p.count}</span>
                <span className="text-[11px] text-neutral-500">{p.posts}</span>
              </div>
            )
          })}
        </div>

        {/* Week grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {PLAN.map((week) => {
            const color = PILLAR_COLOR[week.pillar]
            const isCurrent = week.week === currentWeek.week
            return (
              <WeekCard key={week.week} week={week} color={color} clinicId={clinicId} isCurrent={isCurrent} />
            )
          })}
        </div>

        <p className="text-center text-xs text-neutral-400">
          Source: Content_Plan_Jun 2026-HawaiiWellness_Carousels_v2.pdf · v2.1 compliance baseline
        </p>
      </div>
    </main>
  )
}

function WeekCard({
  week,
  color,
  clinicId,
  isCurrent,
}: {
  week: PlanWeek
  color: string
  clinicId: string
  isCurrent: boolean
}) {
  return (
    <div
      className="flex flex-col gap-4 rounded-2xl border p-5"
      style={{
        background: 'rgba(255,255,255,0.60)',
        backdropFilter: 'blur(20px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
        borderColor: isCurrent ? color : 'rgba(255,255,255,0.72)',
        borderWidth: isCurrent ? 2 : 1,
        boxShadow: isCurrent
          ? `0 4px 24px ${color}20`
          : '0 2px 16px rgba(0,0,0,0.05)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
            Week {week.week}
            {isCurrent && (
              <span
                className="ml-2 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em]"
                style={{ background: `${color}20`, color }}
              >
                Now
              </span>
            )}
          </p>
          <h3 className="mt-0.5 text-[17px] font-bold tracking-tight text-neutral-900">
            {week.theme}
          </h3>
        </div>
        <span
          className="mt-0.5 shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em]"
          style={{
            background: `${color}18`,
            color,
            border: `1px solid ${color}30`,
          }}
        >
          {week.pillar}
        </span>
      </div>

      <p className="text-[13px] leading-relaxed text-neutral-600">{week.description}</p>

      <div className="flex flex-col gap-2">
        {week.posts.map((post) => (
          <div
            key={post.num}
            className="flex items-center justify-between gap-3 rounded-xl px-3 py-2"
            style={{ background: `${color}08`, border: `1px solid ${color}18` }}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="shrink-0 text-[11px] font-bold tabular-nums" style={{ color }}>
                {String(post.num).padStart(2, '0')}
              </span>
              <span className="truncate text-[13px] text-neutral-700">{post.topic}</span>
            </div>
            <span
              className="shrink-0 rounded px-2 py-0.5 font-mono text-[10px] font-semibold"
              style={{ background: `${color}18`, color }}
            >
              {post.keyword}
            </span>
          </div>
        ))}
      </div>

      {clinicId && (
        <a
          href={`/dashboard?clinicId=${clinicId}&tab=generate`}
          className="mt-1 self-start rounded-lg px-3 py-1.5 text-[12px] font-semibold transition hover:opacity-80"
          style={{
            background: `${color}15`,
            color,
            border: `1px solid ${color}25`,
          }}
        >
          Generate a post for this week →
        </a>
      )}
    </div>
  )
}
