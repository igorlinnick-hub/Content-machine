'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { PILLAR_COLOR, getSchedule, getCurrentPlanWeek, type ScheduledPost } from '@/lib/content-plan'
import { ScheduleModal, CHANNEL_CONFIG, type ScheduledPostRow, type ChannelId } from '@/app/components/ScheduleModal'
import { Sparkle } from '@/app/components/ui/icons'

// ── Types ─────────────────────────────────────────────────────────────────────

type ViewMode = 'calendar' | 'list'

// Mirrors /api/publish/buffer/health response — real connector state,
// verified against the live Buffer account (never hardcoded).
interface ChannelHealthInfo {
  status: 'connected' | 'not_found' | 'unverified' | 'not_configured' | 'disconnected'
  name?: string
  username?: string
  avatar?: string
  error?: string
}
interface BufferHealthInfo {
  token: 'ok' | 'missing' | 'invalid'
  verification: 'full' | 'token_only' | 'none'
  channels: Record<string, ChannelHealthInfo>
  error?: string
}

const HEALTH_DOT: Record<ChannelHealthInfo['status'], string> = {
  connected:      '#22c55e',
  unverified:     '#f59e0b',
  not_configured: '#9ca3af',
  not_found:      '#ef4444',
  disconnected:   '#ef4444',
}
const HEALTH_LABEL: Record<ChannelHealthInfo['status'], string> = {
  connected:      'Connected',
  unverified:     'Token OK — channel not verified',
  not_configured: 'Not connected',
  not_found:      'Channel ID not in Buffer account',
  disconnected:   'Buffer disconnected',
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

const ICON_MAP: Record<ChannelId, React.ReactNode> = {
  instagram: <IgIcon />,
  facebook:  <FbIcon />,
  tiktok:    <TtIcon />,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toUTCDateStr(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function buildGrid(year: number, month: number): Date[][] {
  const first = new Date(Date.UTC(year, month, 1))
  const startDow = first.getUTCDay()
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
  const last = weeks[5]
  if (last.every(d => d.getUTCMonth() !== month)) weeks.pop()
  return weeks
}

function fmtTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

// ── Sub-components ────────────────────────────────────────────────────────────

// Derived display state: never show "published" unless we actually know it.
// 'sent' = Buffer accepted the post and its due time has passed.
function postDisplayState(post: ScheduledPostRow): 'failed' | 'published' | 'sent' | 'scheduled' | 'draft' {
  if (post.status === 'failed') return 'failed'
  if (post.status === 'published') return 'published'
  const inBuffer = Object.keys(post.buffer_ids ?? {}).length > 0
  const duePassed = post.scheduled_at ? new Date(post.scheduled_at).getTime() < Date.now() : false
  if (post.status === 'scheduled' && inBuffer && duePassed) return 'sent'
  if (post.status === 'scheduled') return 'scheduled'
  return 'draft'
}

// Buffer-style calendar card: media thumbnail + channel avatars + time + status
function PostCard({
  post,
  onClick,
}: {
  post: ScheduledPostRow
  onClick: () => void
}) {
  const [imgOk, setImgOk] = useState(true)
  const channels = (post.channels ?? []) as ChannelId[]
  const state = postDisplayState(post)

  const channelIcons = (
    <div className="flex items-center">
      {channels.slice(0, 3).map(ch => (
        <span
          key={ch}
          className="-ml-1 first:ml-0 flex h-[18px] w-[18px] items-center justify-center rounded-full text-white shadow ring-2 ring-white"
          style={{ background: CHANNEL_CONFIG[ch]?.color ?? '#666' }}
          title={CHANNEL_CONFIG[ch]?.label}
        >
          <span className="scale-[0.7]">{ICON_MAP[ch]}</span>
        </span>
      ))}
    </div>
  )

  return (
    <button
      onClick={onClick}
      className={`group w-full overflow-hidden rounded-lg border bg-white text-left shadow-sm transition hover:shadow-md ${
        state === 'failed' ? 'border-red-300' : 'border-neutral-200 hover:border-neutral-300'
      }`}
    >
      {post.media_url && imgOk ? (
        <div className="relative h-16 w-full bg-neutral-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.media_url}
            alt=""
            onError={() => setImgOk(false)}
            className={`h-full w-full object-cover ${state === 'draft' ? 'opacity-70' : ''}`}
          />
          <div className="absolute bottom-1 left-1.5">{channelIcons}</div>
          {post.scheduled_at && (
            <span className="absolute right-1 top-1 rounded bg-black/65 px-1 py-px text-[9px] font-semibold tabular-nums text-white">
              {fmtTime(post.scheduled_at)}
            </span>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between px-1.5 pt-1.5">
          {channelIcons}
          {post.scheduled_at && (
            <span className="text-[9px] font-semibold tabular-nums text-neutral-500">
              {fmtTime(post.scheduled_at)}
            </span>
          )}
        </div>
      )}

      <div className="px-1.5 pb-1.5 pt-1">
        <p className="truncate text-[10px] font-medium leading-tight text-neutral-700">{post.caption}</p>
        <p className={`mt-0.5 text-[9px] font-semibold ${
          state === 'failed'    ? 'text-red-600' :
          state === 'published' ? 'text-blue-600' :
          state === 'sent'      ? 'text-green-600' :
          state === 'scheduled' ? 'text-sky-600' :
          'text-neutral-400'
        }`}>
          {state === 'failed'    && '⚠ Failed — not in Buffer'}
          {state === 'published' && '✓ Published'}
          {state === 'sent'      && '✓ Sent via Buffer'}
          {state === 'scheduled' && 'Scheduled'}
          {state === 'draft'     && 'Draft'}
        </p>
      </div>
    </button>
  )
}

// ── Main SchedulerView component ──────────────────────────────────────────────

const CHANNEL_IDS: ChannelId[] = ['instagram', 'facebook', 'tiktok']

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

  // Real scheduled posts from DB
  const [dbPosts, setDbPosts] = useState<ScheduledPostRow[]>([])
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [postsError, setPostsError] = useState<string | null>(null)

  // Live Buffer connector health — checked against the Buffer API on mount
  const [health, setHealth] = useState<BufferHealthInfo | null>(null)
  const [healthLoading, setHealthLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetch('/api/publish/buffer/health')
      .then(r => (r.ok ? (r.json() as Promise<BufferHealthInfo>) : null))
      .then(h => { if (alive) setHealth(h) })
      .catch(() => { if (alive) setHealth(null) })
      .finally(() => { if (alive) setHealthLoading(false) })
    return () => { alive = false }
  }, [])

  // Schedule modal
  const [modalOpen,    setModalOpen]    = useState(false)
  const [editPost,     setEditPost]     = useState<ScheduledPostRow | null>(null)
  const [newPostDate,  setNewPostDate]  = useState<string>('')

  const planSchedule = useMemo(() => getSchedule(), [])
  const grid = useMemo(() => buildGrid(year, month), [year, month])
  const today = toUTCDateStr(now)
  const currentPlanWeek = useMemo(() => getCurrentPlanWeek(), [])

  // Load DB posts for visible month range
  const loadPosts = useCallback(async () => {
    if (!clinicId) {
      setLoadingPosts(false)
      setPostsError('No clinic selected — open the scheduler from a clinic.')
      return
    }
    setLoadingPosts(true)
    try {
      const from = new Date(Date.UTC(year, month, 1)).toISOString()
      const to   = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59)).toISOString()
      const res  = await fetch(`/api/scheduled-posts?clinicId=${clinicId}&from=${from}&to=${to}`)
      if (res.ok) {
        setDbPosts(await res.json() as ScheduledPostRow[])
        setPostsError(null)
      } else {
        // Never fail silently: a 500 here (e.g. the scheduled_posts table not
        // migrated) used to leave the calendar showing the static plan, which
        // reads as "everything is scheduled" when nothing is.
        const body = await res.json().catch(() => null) as { error?: string } | null
        setDbPosts([])
        setPostsError(body?.error ?? `Could not load scheduled posts (HTTP ${res.status})`)
      }
    } catch (e) {
      setDbPosts([])
      setPostsError(e instanceof Error ? e.message : 'Could not reach the scheduler API')
    }
    finally  { setLoadingPosts(false) }
  }, [clinicId, year, month])

  useEffect(() => { loadPosts() }, [loadPosts])

  // Group DB posts by UTC date
  const dbByDate = useMemo(() => {
    const m = new Map<string, ScheduledPostRow[]>()
    for (const p of dbPosts) {
      if (!p.scheduled_at) continue
      const key = toUTCDateStr(new Date(p.scheduled_at))
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(p)
    }
    return m
  }, [dbPosts])

  // Content-plan topics by date (as "placeholder" chips)
  const planByDate = useMemo(() => {
    const m = new Map<string, ScheduledPost[]>()
    for (const sp of planSchedule) {
      const key = toUTCDateStr(sp.date)
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(sp)
    }
    return m
  }, [planSchedule])

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
  function goToday() { setYear(now.getUTCFullYear()); setMonth(now.getUTCMonth()) }

  function toggleChannel(id: ChannelId) {
    setActiveChannels(prev => {
      const next = new Set(prev)
      if (next.has(id)) { if (next.size > 1) next.delete(id) }
      else next.add(id)
      return next
    })
  }

  function openNew(dateStr?: string) {
    setEditPost(null)
    setNewPostDate(dateStr ? `${dateStr}T09:00` : '')
    setModalOpen(true)
  }

  function openEdit(post: ScheduledPostRow) {
    setEditPost(post)
    setNewPostDate('')
    setModalOpen(true)
  }

  function onSaved(post: ScheduledPostRow) {
    // Upsert in local state
    setDbPosts(prev => {
      const exists = prev.find(p => p.id === post.id)
      return exists ? prev.map(p => p.id === post.id ? post : p) : [post, ...prev]
    })
    // Keep the modal open on failure so the Buffer errors stay visible
    if (post.status !== 'failed') setTimeout(() => setModalOpen(false), 1500)
  }

  async function deletePost(id: string) {
    const post = dbPosts.find(p => p.id === id)
    const sent = Object.keys(post?.buffer_ids ?? {})
    const msg = sent.length > 0
      ? `This post was already sent to Buffer (${sent.join(', ')}).\n\nDeleting it here does NOT remove it from Buffer — it will still publish unless you also delete it inside Buffer.\n\nRemove from this app anyway?`
      : 'Remove this scheduled post?'
    if (!confirm(msg)) return
    const res = await fetch(`/api/scheduled-posts/${id}`, { method: 'DELETE' })
    if (!res.ok) { alert('Delete failed — post kept.'); return }
    setDbPosts(prev => prev.filter(p => p.id !== id))
  }

  const q = clinicId ? `?clinicId=${clinicId}` : ''

  // Upcoming real posts
  const upcomingDb = dbPosts
    .filter(p => p.scheduled_at && new Date(p.scheduled_at) >= now)
    .sort((a, b) => (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? ''))
    .slice(0, 10)

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white">

      {/* ── Top nav ── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-100 px-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Link href={`/dashboard${q}`} className="flex items-center gap-2 text-neutral-500 hover:text-neutral-800 transition">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <span className="text-[13px] font-semibold text-neutral-800">Content Scheduler</span>
          {currentPlanWeek && (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-500">
              Week {currentPlanWeek.week} · {currentPlanWeek.theme}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-neutral-200 bg-neutral-50 p-0.5">
            {(['calendar', 'list'] as ViewMode[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`rounded-md px-3 py-1 text-[12px] font-medium capitalize transition ${
                  view === v ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
                }`}>
                {v}
              </button>
            ))}
          </div>
          <button
            onClick={() => openNew()}
            className="flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-sky-600 transition"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Post
          </button>
        </div>
      </header>

      {/* ── Buffer disconnect banner — never fail silently ── */}
      {health && health.token !== 'ok' && (
        <div className="flex shrink-0 items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2">
          <svg className="h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-[12px] font-medium text-red-700">
            Buffer is not connected ({health.token === 'missing' ? 'BUFFER_TOKEN is not set' : 'token rejected by Buffer'}).
            Posts will only be saved as local drafts — <span className="font-bold">nothing will publish</span>.
          </p>
        </div>
      )}
      {/* ── Scheduled posts could not be loaded — say so instead of showing the plan as if it were real ── */}
      {postsError && (
        <div className="flex shrink-0 items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2">
          <svg className="h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-[12px] font-medium text-red-700">
            Scheduled posts could not be loaded — <span className="font-bold">the calendar below is empty, not up to date</span>. {postsError}
          </p>
        </div>
      )}
      {health && health.token === 'ok' && health.verification === 'token_only' && (
        <div className="flex shrink-0 items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2">
          <p className="text-[12px] text-amber-700">
            Buffer token is valid, but channel verification is unavailable — channel IDs could not be checked against the live account.
          </p>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ── */}
        <aside className="flex w-56 shrink-0 flex-col border-r border-neutral-100 bg-white">
          <div className="flex-1 overflow-y-auto py-4">
            <p className="mb-2 px-4 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400">Channels</p>

            <button
              onClick={() => setActiveChannels(new Set<ChannelId>(['instagram', 'facebook', 'tiktok']))}
              className={`flex w-full items-center gap-3 px-4 py-2 text-left transition ${activeChannels.size === 3 ? 'bg-sky-50' : 'hover:bg-neutral-50'}`}
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 text-[10px] font-bold text-neutral-500">All</div>
              <span className={`text-[13px] font-medium ${activeChannels.size === 3 ? 'text-sky-600' : 'text-neutral-700'}`}>All Channels</span>
            </button>

            {CHANNEL_IDS.map(id => {
              const active = activeChannels.has(id)
              const cfg    = CHANNEL_CONFIG[id]
              const ch     = health?.channels?.[id]
              const status = ch?.status
              const handle = ch?.username ? `@${ch.username}` : ch?.name
              const line   = healthLoading
                ? 'Checking…'
                : status
                  ? (status === 'connected' && handle ? handle : HEALTH_LABEL[status])
                  : 'Status unknown'
              const dot    = healthLoading ? '#d1d5db' : status ? HEALTH_DOT[status] : '#d1d5db'
              return (
                <button key={id} onClick={() => toggleChannel(id)}
                  title={ch?.error ?? (status === 'connected' ? `${cfg.label} verified in Buffer` : undefined)}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-left transition ${active ? 'bg-sky-50' : 'hover:bg-neutral-50'}`}
                >
                  <div className="relative shrink-0">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full text-white"
                      style={{ background: cfg.color, opacity: active ? 1 : 0.3 }}>
                      {ICON_MAP[id]}
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${healthLoading ? 'animate-pulse' : ''}`}
                      style={{ background: dot }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[13px] font-medium ${active ? 'text-neutral-900' : 'text-neutral-400'}`}>{cfg.label}</p>
                    <p className={`truncate text-[11px] ${
                      status === 'connected' ? 'text-neutral-400' :
                      status === 'not_found' || status === 'disconnected' ? 'text-red-500' :
                      status === 'unverified' ? 'text-amber-600' :
                      'text-neutral-400'
                    }`}>{line}</p>
                  </div>
                </button>
              )
            })}

            <div className="mx-4 my-4 border-t border-neutral-100" />
            <p className="mb-2 px-4 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400">Generate</p>
            <Link href={`/visual${q}`} className="flex items-center gap-3 px-4 py-2 text-[13px] text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 transition">
              <Sparkle size={14} /> Carousel post
            </Link>
            <Link href={`/dashboard${q}`} className="flex items-center gap-3 px-4 py-2 text-[13px] text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 transition">
              <span className="text-base">✍️</span> Video script
            </Link>
            <Link href={`/content-plan${q}`} className="flex items-center gap-3 px-4 py-2 text-[13px] text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 transition">
              <span className="text-base">📋</span> Content plan
            </Link>

            {/* Stats */}
            <div className="mx-4 mt-4 rounded-xl border border-neutral-100 bg-neutral-50 p-3">
              <p className="text-[11px] font-semibold text-neutral-700">This month</p>
              <p className="mt-0.5 text-[22px] font-bold text-neutral-900">{dbPosts.length}</p>
              <p className="text-[10px] text-neutral-400">scheduled posts</p>
            </div>
          </div>
        </aside>

        {/* ── Main ── */}
        <div className="flex flex-1 flex-col overflow-hidden">

          {/* Month toolbar */}
          <div className="flex shrink-0 items-center gap-3 border-b border-neutral-100 px-5 py-3">
            <button onClick={prevMonth} className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 transition">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
            </button>
            <span className="min-w-[140px] text-center text-[15px] font-semibold text-neutral-900">{monthLabel}</span>
            <button onClick={nextMonth} className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 transition">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            </button>
            <button onClick={goToday} className="rounded-lg border border-neutral-200 px-3 py-1 text-[12px] font-medium text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50 transition">Today</button>
            {loadingPosts && <span className="text-[11px] text-neutral-400">Loading…</span>}
          </div>

          {view === 'calendar' ? (
            <div className="flex flex-1 flex-col overflow-auto">
              {/* Day headers */}
              <div className="grid grid-cols-7 border-b border-neutral-100">
                {DAY_LABELS.map(d => (
                  <div key={d} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{d}</div>
                ))}
              </div>

              {/* Calendar cells */}
              <div className="flex flex-1 flex-col">
                {grid.map((week, wi) => (
                  <div key={wi} className={`grid flex-1 grid-cols-7 ${wi < grid.length - 1 ? 'border-b border-neutral-100' : ''}`}>
                    {week.map((day, di) => {
                      const dateStr   = toUTCDateStr(day)
                      const realPosts = (dbByDate.get(dateStr) ?? []).filter(p =>
                        (p.channels as ChannelId[]).some(ch => activeChannels.has(ch))
                      )
                      const planPosts = dbPosts.length === 0 && !postsError && !loadingPosts
                        ? (planByDate.get(dateStr) ?? [])  // show plan only when the DB genuinely has nothing
                        : []
                      const isMonth   = day.getUTCMonth() === month
                      const isToday   = dateStr === today
                      const isHovered = hoveredDay === dateStr

                      return (
                        <div
                          key={di}
                          onMouseEnter={() => setHoveredDay(dateStr)}
                          onMouseLeave={() => setHoveredDay(null)}
                          className={`group relative flex flex-col gap-1.5 p-2 ${di < 6 ? 'border-r border-neutral-100' : ''} ${!isMonth ? 'bg-neutral-50/60' : 'bg-white'} ${isHovered && isMonth ? 'bg-sky-50/20' : ''} transition-colors`}
                          style={{ minHeight: 150 }}
                        >
                          {/* Day number */}
                          <div className="flex items-center justify-between px-0.5">
                            <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-semibold ${
                              isToday ? 'bg-sky-500 text-white' : isMonth ? 'text-neutral-700' : 'text-neutral-300'
                            }`}>
                              {day.getUTCDate()}
                            </span>
                            {isHovered && isMonth && (
                              <button
                                onClick={() => openNew(dateStr)}
                                className="flex h-5 w-5 items-center justify-center rounded text-neutral-300 opacity-0 hover:bg-sky-100 hover:text-sky-500 group-hover:opacity-100 transition"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                              </button>
                            )}
                          </div>

                          {/* Real scheduled posts */}
                          <div className="flex flex-col gap-1.5">
                            {realPosts.map(p => (
                              <PostCard key={p.id} post={p} onClick={() => openEdit(p)} />
                            ))}

                            {/* Content-plan placeholders (dimmed) — only shown when no real posts */}
                            {planPosts.map((sp, pi) => {
                              const color = PILLAR_COLOR[sp.week.pillar]
                              return (
                                <button
                                  key={pi}
                                  onClick={() => openNew(dateStr)}
                                  className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-left opacity-40 hover:opacity-70 transition"
                                  style={{ background: `${color}10`, borderLeft: `2px solid ${color}` }}
                                  title={`Plan: ${sp.post.topic}`}
                                >
                                  <span className="truncate text-[9px]" style={{ color }}>
                                    {sp.post.topic}
                                  </span>
                                </button>
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
              {upcomingDb.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
                  <div className="text-4xl opacity-30">📅</div>
                  <p className="text-[13px] text-neutral-500">No scheduled posts yet</p>
                  <button
                    onClick={() => openNew()}
                    className="rounded-xl bg-sky-500 px-5 py-2 text-[13px] font-semibold text-white hover:bg-sky-600 transition"
                  >
                    Schedule first post
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {upcomingDb.map(p => {
                    const channels = (p.channels ?? []) as ChannelId[]
                    const dateLabel = p.scheduled_at
                      ? new Date(p.scheduled_at).toLocaleDateString('en-US', {
                          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                        })
                      : 'Draft'
                    const timeLabel = p.scheduled_at ? fmtTime(p.scheduled_at) : ''

                    return (
                      <div key={p.id} className="flex items-start gap-4 overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm">
                        {/* Thumbnail */}
                        {p.media_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.media_url} alt="" className="h-24 w-20 shrink-0 object-cover" />
                        ) : (
                          <div className="flex h-24 w-20 shrink-0 items-center justify-center bg-neutral-100 text-2xl">📝</div>
                        )}

                        <div className="flex flex-1 flex-col gap-1.5 py-3 pr-3">
                          {/* Date + time */}
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-neutral-700">{dateLabel}</span>
                            {timeLabel && <span className="text-[11px] text-neutral-400">{timeLabel}</span>}
                            {(() => {
                              const state = postDisplayState(p)
                              return (
                                <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                                  state === 'failed'    ? 'bg-red-100 text-red-700' :
                                  state === 'sent'      ? 'bg-green-100 text-green-700' :
                                  state === 'published' ? 'bg-blue-100 text-blue-700' :
                                  state === 'scheduled' ? 'bg-sky-100 text-sky-700' :
                                  'bg-neutral-100 text-neutral-500'
                                }`}>{state === 'sent' ? 'sent via buffer' : state}</span>
                              )
                            })()}
                          </div>

                          {/* Caption */}
                          <p className="line-clamp-2 text-[13px] font-medium text-neutral-800">{p.caption}</p>

                          {/* Channel pills */}
                          <div className="flex items-center gap-1.5">
                            {channels.map(ch => {
                              const cfg = CHANNEL_CONFIG[ch]
                              return (
                                <span key={ch} className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium"
                                  style={{ borderColor: `${cfg.color}40`, color: cfg.color, background: `${cfg.color}08` }}>
                                  {ICON_MAP[ch]}
                                  {cfg.label}
                                </span>
                              )
                            })}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex shrink-0 flex-col gap-1.5 py-3 pr-3">
                          <button onClick={() => openEdit(p)}
                            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-[12px] font-medium text-neutral-700 hover:border-sky-300 hover:text-sky-600 transition">
                            Edit
                          </button>
                          <button onClick={() => deletePost(p.id)}
                            className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-neutral-400 hover:text-red-500 transition">
                            Remove
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Schedule Modal ── */}
      <ScheduleModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        clinicId={clinicId}
        editId={editPost?.id}
        bufferIds={editPost?.buffer_ids}
        initialCaption={editPost?.caption ?? ''}
        initialMediaUrl={editPost?.media_url ?? ''}
        initialChannels={(editPost?.channels as ChannelId[]) ?? ['instagram', 'facebook']}
        initialScheduledAt={
          editPost?.scheduled_at
            ? new Date(editPost.scheduled_at).toISOString().slice(0, 16)
            : newPostDate
        }
        onSaved={onSaved}
      />
    </div>
  )
}
