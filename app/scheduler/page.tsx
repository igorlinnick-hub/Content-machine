import Link from 'next/link'
import { redirect } from 'next/navigation'
import { resolveAccess } from '@/lib/auth/session'
import { PageHeader } from '@/app/components/PageHeader'
import {
  PILLAR_COLOR,
  getSchedule,
  type ScheduledPost,
} from '@/lib/content-plan'

export const dynamic = 'force-dynamic'

// ── Channels ─────────────────────────────────────────────────────────────────

interface Channel {
  id: string
  name: string
  icon: string
  status: 'connected' | 'buffer' | 'pending' | 'unavailable'
  statusLabel: string
  href?: string
}

const CHANNELS: Channel[] = [
  {
    id: 'instagram',
    name: 'Instagram',
    icon: '📸',
    status: 'buffer',
    statusLabel: 'Via Buffer',
    href: 'https://publish.buffer.com',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: '📘',
    status: 'buffer',
    statusLabel: 'Via Buffer',
    href: 'https://publish.buffer.com',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: '🎵',
    status: 'pending',
    statusLabel: 'Need business account',
  },
]

const STATUS_STYLE: Record<Channel['status'], { bg: string; text: string; dot: string }> = {
  connected:   { bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-500' },
  buffer:      { bg: 'bg-amber-50',    text: 'text-amber-700',   dot: 'bg-amber-400'   },
  pending:     { bg: 'bg-neutral-100', text: 'text-neutral-500', dot: 'bg-neutral-300'  },
  unavailable: { bg: 'bg-red-50',      text: 'text-red-600',     dot: 'bg-red-400'      },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toUTCDateStr(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

// Returns [year, month0] from "2026-06" or falls back to current UTC month
function parseMonth(param?: string): [number, number] {
  if (param && /^\d{4}-\d{2}$/.test(param)) {
    const [y, m] = param.split('-').map(Number)
    return [y, m - 1]
  }
  const now = new Date()
  return [now.getUTCFullYear(), now.getUTCMonth()]
}

// Build calendar grid: 6 weeks, each week = 7 days (Mon first)
function buildGrid(year: number, month: number): Date[][] {
  // First day of month
  const first = new Date(Date.UTC(year, month, 1))
  // day of week: 0=Sun…6=Sat → convert to Mon=0…Sun=6
  const startDow = (first.getUTCDay() + 6) % 7
  const gridStart = new Date(first)
  gridStart.setUTCDate(1 - startDow)

  const weeks: Date[][] = []
  const cursor = new Date(gridStart)
  for (let w = 0; w < 6; w++) {
    const week: Date[] = []
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cursor))
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
    weeks.push(week)
  }
  return weeks
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function SchedulerPage({
  searchParams,
}: {
  searchParams: { clinicId?: string; month?: string }
}) {
  const access = await resolveAccess()
  if (!access) redirect('/')

  const clinicId =
    access.role === 'admin' ? searchParams.clinicId ?? '' : access.clinicId

  const [year, month] = parseMonth(searchParams.month)
  const prevMonth = new Date(Date.UTC(year, month - 1, 1))
  const nextMonth = new Date(Date.UTC(year, month + 1, 1))

  const grid = buildGrid(year, month)
  const schedule = getSchedule()

  // Index schedule by date string for O(1) lookup
  const byDate = new Map<string, ScheduledPost[]>()
  for (const sp of schedule) {
    const key = toUTCDateStr(sp.date)
    if (!byDate.has(key)) byDate.set(key, [])
    byDate.get(key)!.push(sp)
  }

  const today = toUTCDateStr(new Date())

  // Upcoming posts (next 5 from today)
  const todayDate = new Date()
  todayDate.setUTCHours(0, 0, 0, 0)
  const upcoming = schedule
    .filter((sp) => sp.date >= todayDate)
    .slice(0, 5)

  const monthLabel = new Date(Date.UTC(year, month, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

  const q = clinicId ? `?clinicId=${clinicId}` : ''

  return (
    <main className="min-h-screen cm-page-bg">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <PageHeader
          eyebrow="Content Machine · Scheduler"
          title="Content Scheduler"
          subtitle="Plan, schedule, and track posts across channels — calendar view per clinic"
          back={clinicId ? `/dashboard?clinicId=${clinicId}` : '/dashboard'}
        />

        {/* ── Channels ──────────────────────────────────────────────── */}
        <section>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
            Connected channels
          </p>
          <div className="flex flex-wrap gap-3">
            {CHANNELS.map((ch) => {
              const s = STATUS_STYLE[ch.status]
              const inner = (
                <div
                  className={`flex items-center gap-2.5 rounded-xl border px-4 py-2.5 ${s.bg} border-neutral-200/80 transition`}
                  style={{ backdropFilter: 'blur(12px)' }}
                >
                  <span className="text-lg leading-none">{ch.icon}</span>
                  <div className="flex flex-col">
                    <span className="text-[13px] font-semibold text-neutral-900">{ch.name}</span>
                    <span className={`flex items-center gap-1 text-[11px] font-medium ${s.text}`}>
                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${s.dot}`} />
                      {ch.statusLabel}
                    </span>
                  </div>
                  {ch.status === 'pending' && (
                    <span className="ml-2 rounded bg-neutral-200 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-neutral-500">
                      Soon
                    </span>
                  )}
                  {ch.href && (
                    <svg className={`ml-1 h-3.5 w-3.5 ${s.text} opacity-60`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  )}
                </div>
              )
              return ch.href ? (
                <a key={ch.id} href={ch.href} target="_blank" rel="noreferrer" className="hover:opacity-80">
                  {inner}
                </a>
              ) : (
                <div key={ch.id}>{inner}</div>
              )
            })}

            {/* Add channel button */}
            <button
              type="button"
              disabled
              className="flex items-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-white/50 px-4 py-2.5 text-[13px] font-medium text-neutral-400 transition hover:border-neutral-400 hover:text-neutral-500 disabled:cursor-not-allowed"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Connect account
            </button>
          </div>
        </section>

        {/* ── Main layout: calendar + sidebar ───────────────────────── */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">

          {/* Calendar */}
          <div className="flex-1 overflow-hidden rounded-2xl border border-white/70 bg-white/60 shadow-sm" style={{ backdropFilter: 'blur(20px)' }}>
            {/* Month nav */}
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
              <Link
                href={`/scheduler?month=${monthKey(prevMonth.getUTCFullYear(), prevMonth.getUTCMonth())}${clinicId ? `&clinicId=${clinicId}` : ''}`}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100"
              >
                ‹
              </Link>
              <h2 className="text-[15px] font-semibold text-neutral-900">{monthLabel}</h2>
              <Link
                href={`/scheduler?month=${monthKey(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth())}${clinicId ? `&clinicId=${clinicId}` : ''}`}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100"
              >
                ›
              </Link>
            </div>

            {/* Day labels */}
            <div className="grid grid-cols-7 border-b border-neutral-100">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <div key={d} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                  {d}
                </div>
              ))}
            </div>

            {/* Weeks */}
            {grid.map((week, wi) => (
              <div key={wi} className={`grid grid-cols-7 ${wi < grid.length - 1 ? 'border-b border-neutral-100' : ''}`}>
                {week.map((day, di) => {
                  const dateStr = toUTCDateStr(day)
                  const posts = byDate.get(dateStr) ?? []
                  const isCurrentMonth = day.getUTCMonth() === month
                  const isToday = dateStr === today

                  return (
                    <div
                      key={di}
                      className={`min-h-[72px] p-1.5 sm:p-2 ${di < 6 ? 'border-r border-neutral-100' : ''} ${!isCurrentMonth ? 'bg-neutral-50/40' : ''}`}
                    >
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-medium ${
                          isToday
                            ? 'bg-neutral-900 text-white'
                            : isCurrentMonth
                              ? 'text-neutral-700'
                              : 'text-neutral-300'
                        }`}
                      >
                        {day.getUTCDate()}
                      </span>

                      <div className="mt-1 flex flex-col gap-0.5">
                        {posts.map((sp, pi) => {
                          const color = PILLAR_COLOR[sp.week.pillar]
                          return (
                            <div
                              key={pi}
                              className="truncate rounded px-1 py-0.5 text-[9px] font-semibold leading-tight"
                              style={{ background: `${color}18`, color }}
                              title={sp.post.topic}
                            >
                              {sp.post.topic}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}

            {/* Pillar legend */}
            <div className="flex flex-wrap gap-3 border-t border-neutral-100 px-5 py-3">
              {(
                [
                  ['Mental Health', '#0EA5E9'],
                  ['Pain & Joint', '#B45309'],
                  ['Wellness & Vitality', '#0F766E'],
                  ['Weight Loss', '#A855F7'],
                ] as [string, string][]
              ).map(([name, color]) => (
                <span key={name} className="flex items-center gap-1.5 text-[11px] text-neutral-500">
                  <span className="h-2 w-2 rounded-sm" style={{ background: color }} />
                  {name}
                </span>
              ))}
            </div>
          </div>

          {/* Sidebar: upcoming posts */}
          <div className="flex w-full flex-col gap-4 lg:w-[280px] lg:shrink-0">
            <div
              className="flex flex-col gap-3 rounded-2xl border border-white/70 bg-white/60 p-4 shadow-sm"
              style={{ backdropFilter: 'blur(20px)' }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                Upcoming
              </p>

              {upcoming.map((sp, i) => {
                const color = PILLAR_COLOR[sp.week.pillar]
                const dateLabel = sp.date.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  timeZone: 'UTC',
                })
                return (
                  <div
                    key={i}
                    className="flex flex-col gap-1.5 rounded-xl border p-3"
                    style={{ background: `${color}08`, borderColor: `${color}25` }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-neutral-500">{dateLabel}</span>
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                        style={{ background: `${color}20`, color }}
                      >
                        {sp.week.pillar.split(' ')[0]}
                      </span>
                    </div>
                    <p className="text-[12px] font-medium leading-snug text-neutral-800">
                      {sp.post.topic}
                    </p>
                    <div className="flex gap-1.5">
                      <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-500">
                        📸 IG
                      </span>
                      <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-400">
                        🎵 TT soon
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Quick actions */}
            <div
              className="flex flex-col gap-2 rounded-2xl border border-white/70 bg-white/60 p-4 shadow-sm"
              style={{ backdropFilter: 'blur(20px)' }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                Quick actions
              </p>
              <a
                href={`/visual${q}`}
                className="flex items-center gap-2.5 rounded-xl bg-teal-50 px-3 py-2.5 text-[13px] font-semibold text-teal-700 transition hover:bg-teal-100"
              >
                <span className="text-base">🎨</span>
                Generate carousel post
              </a>
              <a
                href={`/dashboard${q}&tab=generate`}
                className="flex items-center gap-2.5 rounded-xl bg-sky-50 px-3 py-2.5 text-[13px] font-semibold text-sky-700 transition hover:bg-sky-100"
              >
                <span className="text-base">✍️</span>
                Generate video script
              </a>
              <a
                href="https://publish.buffer.com"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2.5 rounded-xl bg-amber-50 px-3 py-2.5 text-[13px] font-semibold text-amber-700 transition hover:bg-amber-100"
              >
                <span className="text-base">📅</span>
                Schedule in Buffer
                <svg className="ml-auto h-3.5 w-3.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>
              <button
                type="button"
                disabled
                className="flex cursor-not-allowed items-center gap-2.5 rounded-xl bg-neutral-50 px-3 py-2.5 text-[13px] font-semibold text-neutral-400"
              >
                <span className="text-base">🎵</span>
                Post to TikTok
                <span className="ml-auto rounded bg-neutral-200 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-neutral-400">
                  Soon
                </span>
              </button>
            </div>

            {/* TikTok note */}
            <div className="rounded-xl border border-neutral-200 bg-white/50 p-3">
              <p className="text-[11px] font-semibold text-neutral-600">TikTok direct posting</p>
              <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">
                Requires a TikTok Business Account. Once set up, posts can go directly from here
                via the TikTok Content Posting API — no manual upload needed.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
