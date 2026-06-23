import { redirect } from 'next/navigation'
import { resolveAccess } from '@/lib/auth/session'
import { PageHeader } from '@/app/components/PageHeader'

export const dynamic = 'force-dynamic'

// ── Data ─────────────────────────────────────────────────────────────────────

type Pillar = 'Mental Health' | 'Pain & Joint' | 'Wellness & Vitality' | 'Weight Loss'

const PILLAR_COLOR: Record<Pillar, string> = {
  'Mental Health': '#0EA5E9',
  'Pain & Joint': '#B45309',
  'Wellness & Vitality': '#0F766E',
  'Weight Loss': '#A855F7',
}

interface WeekPost {
  num: number
  topic: string
  keyword: string
}

interface Week {
  week: number
  theme: string
  pillar: Pillar
  description: string
  posts: WeekPost[]
}

const PLAN: Week[] = [
  {
    week: 1,
    theme: 'Ketamine & Brain',
    pillar: 'Mental Health',
    description:
      'What ketamine actually does to the brain, why antidepressants fail 1 in 3 people, and how to recognize when standard treatment has hit its ceiling.',
    posts: [
      { num: 1, topic: 'What Ketamine Does to Depression', keyword: 'RESET' },
      { num: 2, topic: 'Antidepressant failure — a biology question', keyword: 'MECHANISM' },
      { num: 3, topic: 'Signs standard treatment has hit its ceiling', keyword: 'SIGNS' },
    ],
  },
  {
    week: 2,
    theme: 'Hormones & Aging',
    pillar: 'Wellness & Vitality',
    description:
      'Hormones shift, not just decline. Post-40 energy, testosterone beyond the gym, and NAD+ as the cellular spark plug — all three de-mystified for high performers.',
    posts: [
      { num: 4, topic: 'Hormones after 40 — what actually shifts', keyword: 'HORMONES' },
      { num: 5, topic: "Testosterone isn't about muscle", keyword: 'TESTOSTERONE' },
      { num: 6, topic: 'NAD+ — spark plugs in every cell', keyword: 'NAD' },
    ],
  },
  {
    week: 3,
    theme: 'Pain & Regeneration',
    pillar: 'Pain & Joint',
    description:
      "Painkillers silence the alarm while the tissue keeps breaking down. PRP and shockwave address what's actually happening inside the joint.",
    posts: [
      { num: 7, topic: "Painkillers don't heal joints", keyword: 'JOINT' },
      { num: 8, topic: "PRP — your blood's own repair crew", keyword: 'PRP' },
      { num: 9, topic: 'Shockwave therapy — triggering biology, not just numbing pain', keyword: 'SHOCKWAVE' },
    ],
  },
  {
    week: 4,
    theme: 'Metabolism & Weight',
    pillar: 'Weight Loss',
    description:
      'The body adapts after weight loss — hunger up, metabolism down. GLP-1 medications fix the thermostat; the scale is just the visible result.',
    posts: [
      { num: 10, topic: 'Why diets fail — the adaptation your doctor never explained', keyword: 'METABOLISM' },
      { num: 11, topic: "Semaglutide: the story isn't the scale", keyword: 'SEMAGLUTIDE' },
      { num: 12, topic: '30 days on a GLP-1 — what changes first', keyword: 'GLP1' },
    ],
  },
  {
    week: 5,
    theme: 'SGB & Anxiety/PTSD',
    pillar: 'Mental Health',
    description:
      "Anxiety isn't just in your head — it's in your nervous system. SGB briefly cuts power to the hyperactive alarm circuit. TMS trains the underactive one.",
    posts: [
      { num: 13, topic: 'Stellate Ganglion Block for PTSD', keyword: 'SGB' },
      { num: 14, topic: "Anxiety isn't only in your head", keyword: 'ANXIETY' },
      { num: 15, topic: 'TMS for depression — training an underactive muscle', keyword: 'TMS' },
    ],
  },
  {
    week: 6,
    theme: 'Peptides & Recovery',
    pillar: 'Wellness & Vitality',
    description:
      'Peptides are signaling molecules, not steroids. IV delivery bypasses digestion. Vascular health determines more than most patients realize.',
    posts: [
      { num: 16, topic: 'Peptides — a text message to your biology', keyword: 'PEPTIDE' },
      { num: 17, topic: 'IV drips — when delivery method matters', keyword: 'IV' },
      { num: 18, topic: 'Erectile dysfunction — the canary in the coal mine', keyword: 'VITALITY' },
    ],
  },
  {
    week: 7,
    theme: 'Spravato & Severe Depression',
    pillar: 'Mental Health',
    description:
      'Treatment-resistant depression is a defined medical status. Spravato (FDA-approved esketamine) and the hard conversation around suicidal ideation.',
    posts: [
      { num: 19, topic: 'Spravato — FDA-approved esketamine nasal spray', keyword: 'SPRAVATO' },
      { num: 20, topic: 'Suicidal ideation — what clinical options exist', keyword: 'SUPPORT' },
      { num: 21, topic: '"Just talk to someone" isn\'t enough', keyword: 'CLARITY' },
    ],
  },
  {
    week: 8,
    theme: 'A2M Biologics & Complex Pain',
    pillar: 'Pain & Joint',
    description:
      "A2M guards cartilage from the specific enzymes that degrade it. Retatrutide pulls three metabolic levers at once. A comprehensive panel shows what's actually happening.",
    posts: [
      { num: 22, topic: 'A2M — guards that cuff the cartilage vandals', keyword: 'A2M' },
      { num: 23, topic: 'Retatrutide — triple-action metabolic signal', keyword: 'RETATRUTIDE' },
      { num: 24, topic: 'Comprehensive blood panel — catching fires before they start', keyword: 'PROGRAM' },
    ],
  },
]

const PILLARS: { name: Pillar; count: number; posts: string }[] = [
  { name: 'Mental Health', count: 9, posts: 'Posts 01-03, 13-15, 19-21' },
  { name: 'Pain & Joint', count: 4, posts: 'Posts 07-09, 22' },
  { name: 'Wellness & Vitality', count: 7, posts: 'Posts 04-06, 16-18, 24' },
  { name: 'Weight Loss', count: 4, posts: 'Posts 10-12, 23' },
]

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function ContentPlanPage({
  searchParams,
}: {
  searchParams: { clinicId?: string }
}) {
  const access = await resolveAccess()
  if (!access) redirect('/')

  const clinicId =
    access.role === 'admin' ? searchParams.clinicId ?? '' : access.clinicId

  return (
    <main className="min-h-screen cm-page-bg">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
        <PageHeader
          eyebrow="Content Machine · Plan"
          title="Content Plan"
          subtitle="8-week carousel cycle · 24 posts · 3 per week · 4 pillars"
          back={clinicId ? `/dashboard?clinicId=${clinicId}` : '/dashboard'}
        />

        {/* Pillar legend */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PILLARS.map((p) => {
            const color = PILLAR_COLOR[p.name]
            return (
              <div
                key={p.name}
                className="flex flex-col gap-1 rounded-xl border p-3"
                style={{
                  background: `${color}0d`,
                  borderColor: `${color}30`,
                }}
              >
                <span
                  className="text-[10px] font-bold uppercase tracking-[0.14em]"
                  style={{ color }}
                >
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
            return (
              <WeekCard key={week.week} week={week} color={color} clinicId={clinicId} />
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
}: {
  week: Week
  color: string
  clinicId: string
}) {
  return (
    <div
      className="flex flex-col gap-4 rounded-2xl border p-5"
      style={{
        background: 'rgba(255,255,255,0.60)',
        backdropFilter: 'blur(20px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
        borderColor: 'rgba(255,255,255,0.72)',
        boxShadow: '0 2px 16px rgba(0,0,0,0.05)',
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
            Week {week.week}
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

      {/* Description */}
      <p className="text-[13px] leading-relaxed text-neutral-600">{week.description}</p>

      {/* Posts list */}
      <div className="flex flex-col gap-2">
        {week.posts.map((post) => (
          <div
            key={post.num}
            className="flex items-center justify-between gap-3 rounded-xl px-3 py-2"
            style={{ background: `${color}08`, border: `1px solid ${color}18` }}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className="shrink-0 text-[11px] font-bold tabular-nums"
                style={{ color }}
              >
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

      {/* Generate link */}
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
