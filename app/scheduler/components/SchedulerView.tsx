'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { PLAN, PILLAR_COLOR, getSchedule, type ScheduledPost } from '@/lib/content-plan'

// ── Types ─────────────────────────────────────────────────────────────────────

type ChannelId = 'instagram' | 'facebook' | 'tiktok'
type ViewMode = 'calendar' | 'list'

interface Channel {
  id: ChannelId
  name: string
  handle: string
  status: 'connected' | 'pending'
  color: string
  icon: React.ReactNode
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const IgIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
  </svg>
)

const FbIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
)

const TtIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.26 8.26 0 004.84 1.56V6.81a4.85 4.85 0 01-1.07-.12z"/>
  </svg>
)

// ── Helpers ───────────────────────────────────────────────────────────────────

function toUTCDateStr(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function buildGrid(year: number, month: number): Date[][] {
  const first = new Date(Date.UTC(year, month, 1))
  // Buffer uses Sun-Sat
  const startDow = first.getUTCDay() // 0=Sun
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
  // Drop last week if entirely outside the month
  const last = weeks[5]
  if (last.every(d => d.getUTCMonth() !== month)) weeks.pop()
  return weeks
}

// ── Component ─────────────────────────────────────────────────────────────────

const CHANNELS: Channel[] = [
  { id: 'instagram', name: 'Instagram',  handle: '@hawaiiwellnessclinic', status: 'connected', color: '#E1306C', icon: <IgIcon /> },
  { id: 'facebook',  name: 'Facebook',   handle: 'Hawaii Wellness Clinic', status: 'connected', color: '#1877F2', icon: <FbIcon /> },
  { id: 'tiktok',    name: 'TikTok',     handle: '@hawaiiwellnessclinic', status: 'pending',   color: '#010101', icon: <TtIcon /> },
]

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function SchedulerView({ clinicId }: { clinicId: string }) {
  const now = new Date()
  const [year, setYear]   = useState(now.getUTCFullYear())
  const [month, setMonth] = useState(now.getUTCMonth())
  const [view, setView]   = useState<ViewMode>('calendar')
  const [activeChannels, setActiveChannels] = useState<Set<ChannelId>>(
    new Set<ChannelId>(['instagram', 'facebook', 'tiktok'])
  )
  const [hoveredDay, setHoveredDay] = useState<string | null>(null)

  const schedule = useMemo(() => getSchedule(), [])
  const grid     = useMemo(() => buildGrid(year, month), [year, month])
  const today    = toUTCDateStr(now)

  const byDate = useMemo(() => {
    const m = new Map<string, ScheduledPost[]>()
    for (const sp of schedule) {
      const key = toUTCDateStr(sp.date)
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(sp)
    }
    return m
  }, [schedule])

  const monthLabel = new Date(Date.UTC(year, month, 1)).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  })

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }
  function goToday() {
    setYear(now.getUTCFullYear())
    setMonth(now.getUTCMonth())
  }

  function toggleChannel(id: ChannelId) {
    setActiveChannels(prev => {
      const next = new Set(prev)
      if (next.has(id)) { if (next.size > 1) next.delete(id) }
      else next.add(id)
      return next
    })
  }

  const q = clinicId ? `?clinicId=${clinicId}` : ''

  // Upcoming posts (next 5)
  const todayMidnight = new Date(); todayMidnight.setUTCHours(0,0,0,0)
  const upcoming = schedule.filter(sp => sp.date >= todayMidnight).slice(0, 5)

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white">

      {/* ── Top nav bar ── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-100 bg-white px-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Link href={`/dashboard${q}`} className="flex items-center gap-2 text-neutral-500 transition hover:text-neutral-800">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <span className="text-[13px] font-semibold text-neutral-800">Content Scheduler</span>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-neutral-200 bg-neutral-50 p-0.5">
            {(['calendar', 'list'] as ViewMode[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-md px-3 py-1 text-[12px] font-medium capitalize transition ${
                  view === v ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          {/* New Post */}
          <Link
            href={`/visual${q}`}
            className="flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-1.5 text-[13px] font-semibold text-white transition hover:bg-sky-600"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Post
          </Link>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Left sidebar ── */}
        <aside className="flex w-56 shrink-0 flex-col border-r border-neutral-100 bg-white">
          <div className="flex-1 overflow-y-auto py-4">

            {/* Channels */}
            <p className="mb-2 px-4 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400">
              Channels
            </p>

            {/* All channels */}
            <button
              onClick={() => setActiveChannels(new Set<ChannelId>(['instagram', 'facebook', 'tiktok']))}
              className={`flex w-full items-center gap-3 px-4 py-2 text-left transition ${
                activeChannels.size === 3 ? 'bg-sky-50' : 'hover:bg-neutral-50'
              }`}
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 text-[10px] font-bold text-neutral-500">
                All
              </div>
              <span className={`text-[13px] font-medium ${activeChannels.size === 3 ? 'text-sky-600' : 'text-neutral-700'}`}>
                All Channels
              </span>
            </button>

            {CHANNELS.map(ch => {
              const active = activeChannels.has(ch.id)
              return (
                <button
                  key={ch.id}
                  onClick={() => toggleChannel(ch.id)}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-left transition ${
                    active ? 'bg-sky-50' : 'hover:bg-neutral-50'
                  }`}
                >
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
                    style={{ background: ch.id === 'tiktok' ? '#000' : ch.color, opacity: active ? 1 : 0.35 }}
                  >
                    {ch.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[13px] font-medium ${active ? 'text-neutral-900' : 'text-neutral-400'}`}>
                      {ch.name}
                    </p>
                    <p className="truncate text-[11px] text-neutral-400">{ch.handle}</p>
                  </div>
                  {ch.status === 'pending' && (
                    <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[9px] font-semibold text-neutral-400">
                      Soon
                    </span>
                  )}
                </button>
              )
            })}

            <div className="mx-4 my-4 border-t border-neutral-100" />

            {/* Quick links */}
            <p className="mb-2 px-4 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400">
              Generate
            </p>
            <Link href={`/visual${q}`} className="flex items-center gap-3 px-4 py-2 text-[13px] text-neutral-600 transition hover:bg-neutral-50 hover:text-neutral-900">
              <span className="text-base">🎨</span> Carousel post
            </Link>
            <Link href={`/dashboard${q}&tab=generate`} className="flex items-center gap-3 px-4 py-2 text-[13px] text-neutral-600 transition hover:bg-neutral-50 hover:text-neutral-900">
              <span className="text-base">✍️</span> Video script
            </Link>
            <Link href={`/content-plan${q}`} className="flex items-center gap-3 px-4 py-2 text-[13px] text-neutral-600 transition hover:bg-neutral-50 hover:text-neutral-900">
              <span className="text-base">📋</span> Content plan
            </Link>

            {/* Buffer note */}
            <div className="mx-4 mt-4 rounded-xl border border-amber-100 bg-amber-50 p-3">
              <p className="text-[11px] font-semibold text-amber-700">Publishing via Buffer</p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-amber-600">
                Instagram · Facebook · TikTok all connected. Direct API coming soon.
              </p>
              <a
                href="https://publish.buffer.com"
                target="_blank"
                rel="noreferrer"
                className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:underline"
              >
                Open Buffer
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>
            </div>
          </div>
        </aside>

        {/* ── Main area ── */}
        <div className="flex flex-1 flex-col overflow-hidden">

          {/* Month nav toolbar */}
          <div className="flex shrink-0 items-center gap-3 border-b border-neutral-100 bg-white px-5 py-3">
            <button onClick={prevMonth} className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <span className="min-w-[140px] text-center text-[15px] font-semibold text-neutral-900">{monthLabel}</span>
            <button onClick={nextMonth} className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
            <button onClick={goToday} className="rounded-lg border border-neutral-200 px-3 py-1 text-[12px] font-medium text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50">
              Today
            </button>
          </div>

          {view === 'calendar' ? (
            <div className="flex flex-1 flex-col overflow-auto">
              {/* Day headers */}
              <div className="grid grid-cols-7 border-b border-neutral-100">
                {DAY_LABELS.map(d => (
                  <div key={d} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="flex flex-1 flex-col">
                {grid.map((week, wi) => (
                  <div key={wi} className={`grid flex-1 grid-cols-7 ${wi < grid.length - 1 ? 'border-b border-neutral-100' : ''}`}>
                    {week.map((day, di) => {
                      const dateStr   = toUTCDateStr(day)
                      const posts     = byDate.get(dateStr) ?? []
                      const isMonth   = day.getUTCMonth() === month
                      const isToday   = dateStr === today
                      const isHovered = hoveredDay === dateStr

                      return (
                        <div
                          key={di}
                          onMouseEnter={() => setHoveredDay(dateStr)}
                          onMouseLeave={() => setHoveredDay(null)}
                          className={`group relative flex flex-col gap-1 p-2 ${di < 6 ? 'border-r border-neutral-100' : ''} ${!isMonth ? 'bg-neutral-50/60' : 'bg-white'} transition-colors ${isHovered && isMonth ? 'bg-sky-50/30' : ''}`}
                          style={{ minHeight: 100 }}
                        >
                          {/* Day number */}
                          <div className="flex items-center justify-between">
                            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-medium ${
                              isToday
                                ? 'bg-sky-500 text-white'
                                : isMonth ? 'text-neutral-700' : 'text-neutral-300'
                            }`}>
                              {day.getUTCDate()}
                            </span>
                            {isHovered && isMonth && (
                              <Link
                                href={`/visual${q}`}
                                className="flex h-5 w-5 items-center justify-center rounded text-neutral-400 opacity-0 transition hover:bg-sky-100 hover:text-sky-600 group-hover:opacity-100"
                              >
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                              </Link>
                            )}
                          </div>

                          {/* Post chips */}
                          <div className="flex flex-col gap-0.5">
                            {posts.map((sp, pi) => {
                              const color = PILLAR_COLOR[sp.week.pillar]
                              return (
                                <div
                                  key={pi}
                                  className="flex items-center gap-1 rounded-md px-1.5 py-0.5"
                                  style={{ background: `${color}15`, borderLeft: `3px solid ${color}` }}
                                  title={sp.post.topic}
                                >
                                  {/* Platform mini-icons */}
                                  <div className="flex gap-0.5">
                                    {(['instagram', 'facebook'] as ChannelId[])
                                      .filter(id => activeChannels.has(id))
                                      .map(id => {
                                        const ch = CHANNELS.find(c => c.id === id)!
                                        return (
                                          <span key={id} style={{ color: ch.color }} className="text-[8px]">
                                            {id === 'instagram' ? '●' : '●'}
                                          </span>
                                        )
                                      })}
                                  </div>
                                  <span className="truncate text-[10px] font-medium leading-tight" style={{ color }}>
                                    {sp.post.topic}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* List view */
            <div className="flex-1 overflow-auto p-5">
              <div className="flex flex-col gap-3">
                {upcoming.map((sp, i) => {
                  const color = PILLAR_COLOR[sp.week.pillar]
                  const dateLabel = sp.date.toLocaleDateString('en-US', {
                    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
                  })
                  return (
                    <div key={i} className="flex items-start gap-4 rounded-xl border border-neutral-100 bg-white p-4 shadow-sm">
                      <div className="flex w-32 shrink-0 flex-col">
                        <span className="text-[11px] font-semibold text-neutral-500">{dateLabel.split(',')[0]}</span>
                        <span className="text-[12px] text-neutral-400">{dateLabel.split(',').slice(1).join(',').trim()}</span>
                      </div>
                      <div className="flex flex-1 flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                            style={{ background: `${color}18`, color }}
                          >
                            {sp.week.pillar}
                          </span>
                          <span className="text-[11px] text-neutral-400">Week {sp.week.week} · {sp.week.theme}</span>
                        </div>
                        <p className="text-[14px] font-medium text-neutral-800">{sp.post.topic}</p>
                        <div className="flex gap-1.5">
                          {CHANNELS.filter(ch => activeChannels.has(ch.id)).map(ch => (
                            <span key={ch.id} className="flex items-center gap-1 rounded-full border border-neutral-200 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
                              <span style={{ color: ch.color }}>{ch.icon}</span>
                              {ch.name}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col gap-2">
                        <a
                          href="https://publish.buffer.com"
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-neutral-200 px-3 py-1.5 text-[12px] font-medium text-neutral-700 transition hover:border-sky-300 hover:text-sky-600"
                        >
                          Schedule →
                        </a>
                        <Link
                          href={`/visual${q}`}
                          className="rounded-lg bg-sky-50 px-3 py-1.5 text-center text-[12px] font-medium text-sky-600 transition hover:bg-sky-100"
                        >
                          Generate
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
