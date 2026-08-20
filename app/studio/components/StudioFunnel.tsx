'use client'

import { useState } from 'react'
import type { RoleBlock } from '@/types'
import { RoleScript } from './RoleScript'
import { Sparkle, SparkleSpinner } from '@/app/components/ui/icons'

type Status = 'candidate' | 'liked' | 'shotlist' | 'rejected'
type Tab = 'discover' | 'liked' | 'shotlist' | 'trash'

export interface StudioCardIdea {
  script_id: string
  topic: string
  hook: string
  script: string
  steps: string[]
  role_blocks: RoleBlock[] | null
}

export interface StudioCard {
  id: string
  status: Status
  shot_type: 'doctor' | 'clinic'
  account: string | null
  view_count: number | null
  title: string | null
  style_description: string | null
  source_url: string | null
  video_url: string | null
  embed_url: string | null
  thumbnail_url: string | null
  shoot_date: string | null
  schema_beats: { name: string; text: string }[]
  template_scaffold: string | null
  idea: StudioCardIdea | null
}

// Plain YYYY-MM-DD. `new Date(iso)` would read it as UTC midnight and render
// the day before in Hawaii, so the parts are split by hand.
function fmtShootDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function formatViews(n: number | null): string | null {
  if (n == null) return null
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return `${n}`
}

const TABS: { key: Tab; label: string; status: Status; adminOnly?: boolean }[] = [
  { key: 'discover', label: 'Discover', status: 'candidate' },
  { key: 'liked', label: 'Liked', status: 'liked' },
  { key: 'shotlist', label: 'Shot List', status: 'shotlist' },
  { key: 'trash', label: '🗑 Trash', status: 'rejected', adminOnly: true },
]

function VideoBox({ card }: { card: StudioCard }) {
  const views = formatViews(card.view_count)
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold text-neutral-900">
          {card.account ?? 'Reference reel'}
        </span>
        {views && (
          <span className="shrink-0 rounded-full bg-neutral-900 px-2 py-0.5 text-[11px] font-semibold text-white">
            👁 {views}
          </span>
        )}
      </div>
      {card.embed_url ? (
        <iframe
          src={card.embed_url}
          className="h-[480px] w-full rounded-xl border-0 bg-neutral-100"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
          allowFullScreen
          loading="lazy"
          title={card.title ?? 'Reference reel'}
        />
      ) : card.video_url ? (
        <video
          controls
          playsInline
          preload="metadata"
          poster={card.thumbnail_url ?? undefined}
          className="aspect-[9/16] w-full rounded-xl bg-neutral-900 object-cover"
          src={card.video_url}
        />
      ) : (
        <div className="relative flex aspect-[9/16] w-full items-end justify-center overflow-hidden rounded-xl bg-neutral-100">
          {card.thumbnail_url && (
            <img
              src={card.thumbnail_url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          {card.source_url ? (
            <a
              href={card.source_url}
              target="_blank"
              rel="noreferrer"
              className="relative z-10 mb-3 rounded-lg bg-black/70 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black/90"
            >
              View original →
            </a>
          ) : (
            !card.thumbnail_url && (
              <span className="pb-4 text-sm text-neutral-400">No video</span>
            )
          )}
        </div>
      )}
    </>
  )
}

const FILMING_BASICS = [
  'Film inside the clinic',
  'Phone vertical (9:16), face the light',
  'Quiet room, talk close for clean audio',
  'One take, keep it under 60s',
  'Editor adds on-screen images & captions after',
]

export function StudioFunnel({
  clinicId,
  isAdmin,
  initialTab,
  initialCards,
  driveInboxUrl,
  initialBoardLink,
}: {
  clinicId: string
  isAdmin: boolean
  initialTab: Tab
  initialCards: StudioCard[]
  driveInboxUrl: string | null
  initialBoardLink: string | null
}) {
  const [cards, setCards] = useState(initialCards)
  const [tab, setTab] = useState<Tab>(initialTab)
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [tweaks, setTweaks] = useState<Record<string, string>>({})
  const [addUrl, setAddUrl] = useState('')
  const [addNote, setAddNote] = useState('')
  const [addForMA, setAddForMA] = useState(true)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [boardLink, setBoardLink] = useState<string | null>(initialBoardLink)
  const [linkBusy, setLinkBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [discoverVisible, setDiscoverVisible] = useState(20)
  const [fetching, setFetching] = useState(false)
  const [fetchMsg, setFetchMsg] = useState<string | null>(null)

  async function fetchMoreIdeas() {
    setFetching(true)
    setFetchMsg(null)
    try {
      const res = await fetch('/api/studio/fetch-more', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setFetchMsg(data.error || 'Failed to fetch')
        return
      }
      setFetchMsg(`Added ${data.added} new idea${data.added !== 1 ? 's' : ''} — refresh to see them`)
    } catch {
      setFetchMsg('Network error')
    } finally {
      setFetching(false)
    }
  }

  async function addVideo() {
    const url = addUrl.trim()
    if (!url) return
    setAdding(true)
    setAddError(null)
    try {
      const res = await fetch('/api/studio/videos/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicId,
          url,
          note: addNote.trim() || undefined,
          shotType: addForMA ? 'clinic' : 'doctor',
          schedule: addForMA,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setAddError(data.error || 'Failed to add')
        return
      }
      if (data.scheduleError) {
        setAddError(`Added, but not scheduled: ${data.scheduleError}`)
        return
      }
      setAddUrl('')
      setAddNote('')
      window.location.reload()
    } catch {
      setAddError('Network error')
    } finally {
      setAdding(false)
    }
  }

  // Booking a day is what puts a video on the MAs' board. Left of this the
  // Shot List is just a pile; right of it it's a dated plan.
  async function schedule(id: string, date?: string) {
    setBusyFor(id, true)
    setErrorFor(id, null)
    try {
      const res = await fetch(`/api/studio/videos/${id}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId, date }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setErrorFor(id, data.error || 'Failed')
        return
      }
      setCards((cs) =>
        cs.map((c) => (c.id === id ? { ...c, shoot_date: data.shootDate } : c))
      )
    } catch {
      setErrorFor(id, 'Network error')
    } finally {
      setBusyFor(id, false)
    }
  }

  async function unschedule(id: string) {
    setBusyFor(id, true)
    setErrorFor(id, null)
    try {
      const res = await fetch(`/api/studio/videos/${id}/schedule`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setErrorFor(id, data.error || 'Failed')
        return
      }
      setCards((cs) => cs.map((c) => (c.id === id ? { ...c, shoot_date: null } : c)))
    } catch {
      setErrorFor(id, 'Network error')
    } finally {
      setBusyFor(id, false)
    }
  }

  async function mintBoardLink(rotate: boolean) {
    if (rotate && !confirm('Rotate the link? The old one stops working for everyone.')) return
    setLinkBusy(true)
    try {
      const res = await fetch('/api/studio/board-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId, rotate }),
      })
      const data = await res.json()
      if (res.ok && data.ok) setBoardLink(`${window.location.origin}${data.path}`)
    } finally {
      setLinkBusy(false)
    }
  }

  async function copyBoardLink() {
    if (!boardLink) return
    await navigator.clipboard.writeText(boardLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const setBusyFor = (id: string, v: boolean) =>
    setBusy((b) => ({ ...b, [id]: v }))
  const setErrorFor = (id: string, v: string | null) =>
    setErrors((e) => ({ ...e, [id]: v ?? '' }))

  async function move(id: string, status: Status) {
    setBusyFor(id, true)
    setErrorFor(id, null)
    try {
      const res = await fetch(`/api/studio/videos/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId, status }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setErrorFor(id, data.error || 'Failed')
        return
      }
      setCards((cs) => cs.map((c) => (c.id === id ? { ...c, status } : c)))
    } catch {
      setErrorFor(id, 'Network error')
    } finally {
      setBusyFor(id, false)
    }
  }

  // Permanently delete a video from the Trash (admin only).
  async function deleteForever(id: string) {
    setBusyFor(id, true)
    setErrorFor(id, null)
    try {
      const res = await fetch(`/api/studio/videos/${id}?clinicId=${clinicId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setErrorFor(id, data.error || 'Failed')
        return
      }
      setCards((cs) => cs.filter((c) => c.id !== id))
    } catch {
      setErrorFor(id, 'Network error')
    } finally {
      setBusyFor(id, false)
    }
  }

  async function generate(id: string) {
    setBusyFor(id, true)
    setErrorFor(id, null)
    try {
      const res = await fetch(`/api/studio/videos/${id}/generate-idea`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId, note: tweaks[id] || undefined }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setErrorFor(id, data.error || 'Failed')
        return
      }
      setCards((cs) =>
        cs.map((c) => (c.id === id ? { ...c, idea: data.idea } : c))
      )
    } catch {
      setErrorFor(id, 'Network error')
    } finally {
      setBusyFor(id, false)
    }
  }

  const tabStatus = TABS.find((t) => t.key === tab)!.status
  const allShown = cards.filter((c) => c.status === tabStatus)
  const shown = tab === 'discover' ? allShown.slice(0, discoverVisible) : allShown
  const countFor = (s: Status) => cards.filter((c) => c.status === s).length

  return (
    <div className="flex flex-col gap-5">
      {/* Tabs — the funnel, left to right */}
      <nav className="flex flex-col gap-2 border-b border-neutral-200 pb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {TABS.filter((t) => !t.adminOnly || isAdmin).map((t, i) => (
            <div key={t.key} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-neutral-300">→</span>}
              <button
                type="button"
                onClick={() => setTab(t.key)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  tab === t.key
                    ? 'bg-neutral-900 text-white'
                    : 'border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                {t.label}
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    tab === t.key
                      ? 'bg-white/20 text-white'
                      : 'bg-neutral-100 text-neutral-500'
                  }`}
                >
                  {countFor(t.status)}
                </span>
              </button>
            </div>
          ))}
        </div>
        <p className="text-xs text-neutral-500">
          {tab === 'discover' && 'New reels to review — Like the ones that fit the clinic, Skip the rest.'}
          {tab === 'liked' && "The team's picks. The admin promotes the best to the Shot List."}
          {tab === 'shotlist' && 'What we film. Generate a shoot idea for each — swipe sideways for more.'}
        </p>
      </nav>

      {/* Admin: fetch more TikTok ideas into Discover */}
      {tab === 'discover' && isAdmin && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={fetchMoreIdeas}
            disabled={fetching}
            className="cm-btn cm-btn-ghost text-sm"
          >
            {fetching ? 'Fetching… (~1 min)' : '🔍 Fetch more ideas'}
          </button>
          {fetchMsg && (
            <span className={`text-xs ${fetchMsg.startsWith('Added') ? 'text-emerald-600' : 'text-red-600'}`}>
              {fetchMsg}
            </span>
          )}
        </div>
      )}

      {/* Admin: paste a reel -> brief written -> day booked, in one go */}
      {tab === 'shotlist' && isAdmin && (
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Add your own video to the Shot List
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              className="cm-input min-w-0 flex-1 text-sm"
              placeholder="Paste an Instagram reel, TikTok or YouTube link…"
              value={addUrl}
              onChange={(e) => {
                setAddUrl(e.target.value)
                if (addError) setAddError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addVideo()
              }}
            />
            <button
              type="button"
              onClick={addVideo}
              disabled={adding || !addUrl.trim()}
              className="cm-btn cm-btn-primary text-sm"
            >
              {adding ? 'Adding…' : '➕ Add'}
            </button>
          </div>
          {/* Instagram gives us no cover frame to read, so this one line is
              all the machine has to go on — and all you have to write. */}
          <input
            className="cm-input mt-2 w-full text-sm"
            placeholder="One line: what you like about it / what we should film"
            value={addNote}
            onChange={(e) => setAddNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addVideo()
            }}
          />
          <label className="mt-2 flex items-center gap-2 text-xs text-neutral-600">
            <input
              type="checkbox"
              checked={addForMA}
              onChange={(e) => setAddForMA(e.target.checked)}
            />
            For the MAs — book the next free day and put it on their board
          </label>
          {addError && <p className="mt-1 text-xs text-red-600">{addError}</p>}
        </div>
      )}

      {/* Admin: the read-only link the MAs open */}
      {tab === 'shotlist' && isAdmin && (
        <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-violet-700">
            MA shoot board — one link, no login
          </p>
          {boardLink ? (
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-2 py-1.5 text-xs text-neutral-700">
                {boardLink}
              </code>
              <button type="button" onClick={copyBoardLink} className="cm-btn cm-btn-primary text-xs">
                {copied ? '✓ Copied' : 'Copy'}
              </button>
              <a href={boardLink} target="_blank" rel="noreferrer" className="cm-btn cm-btn-ghost text-xs">
                Open
              </a>
              <button
                type="button"
                onClick={() => mintBoardLink(true)}
                disabled={linkBusy}
                className="cm-btn cm-btn-ghost text-xs"
              >
                Rotate
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => mintBoardLink(false)}
              disabled={linkBusy}
              className="cm-btn cm-btn-primary text-xs"
            >
              {linkBusy ? 'Creating…' : 'Create the link'}
            </button>
          )}
          <p className="mt-1.5 text-[11px] text-violet-700/70">
            Drop it in the work chat once. It always shows today&apos;s video.
          </p>
        </div>
      )}

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-12 text-center text-sm text-neutral-600">
          {tab === 'discover' && 'No new reels to review. Add some to the base.'}
          {tab === 'liked' && 'Nothing liked yet. Like reels in Discover.'}
          {tab === 'shotlist' &&
            (isAdmin
              ? 'Shot List is empty. Promote liked reels here.'
              : 'Shot List is empty. The admin sets what we film.')}
          {tab === 'trash' && 'Trash is empty. Skipped / removed reels land here.'}
        </div>
      ) : (
        <div
          className={
            tab === 'shotlist'
              ? '-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6'
              : 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'
          }
        >
          {shown.map((card) => (
            <div
              key={card.id}
              className={`flex shrink-0 flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:shadow-md ${
                tab === 'shotlist' ? 'w-[340px] snap-start sm:w-[380px]' : ''
              }`}
            >
              <VideoBox card={card} />

              {/* DISCOVER — like / skip */}
              {tab === 'discover' && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => move(card.id, 'liked')}
                    disabled={busy[card.id]}
                    className="cm-btn cm-btn-success flex-1 text-xs"
                  >
                    {busy[card.id] ? '…' : '👍 Like'}
                  </button>
                  <button
                    type="button"
                    onClick={() => move(card.id, 'rejected')}
                    disabled={busy[card.id]}
                    className="cm-btn cm-btn-ghost flex-1 text-xs"
                  >
                    👎 Skip
                  </button>
                </div>
              )}

              {/* LIKED — admin promotes; anyone can remove */}
              {tab === 'liked' && (
                <div className="flex gap-2">
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => move(card.id, 'shotlist')}
                      disabled={busy[card.id]}
                      className="cm-btn cm-btn-primary flex-1 text-xs"
                    >
                      <Sparkle size={15} twin /> Add to Shot List
                    </button>
                  ) : (
                    <span className="flex-1 text-center text-[11px] text-neutral-400">
                      Admin sets the Shot List
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => move(card.id, 'rejected')}
                    disabled={busy[card.id]}
                    className="cm-btn cm-btn-ghost text-xs"
                  >
                    Remove
                  </button>
                </div>
              )}

              {/* SHOT LIST — schema + template + idea + generate */}
              {tab === 'shotlist' && (
                <>
                  {isAdmin && (
                    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-violet-50 px-3 py-2">
                      {card.shoot_date ? (
                        <>
                          <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                            📅 {fmtShootDay(card.shoot_date)}
                          </span>
                          <input
                            type="date"
                            value={card.shoot_date}
                            onChange={(e) => schedule(card.id, e.target.value)}
                            disabled={busy[card.id]}
                            className="rounded-lg border border-violet-200 bg-white px-2 py-1 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => unschedule(card.id)}
                            disabled={busy[card.id]}
                            className="text-[11px] text-neutral-500 underline"
                          >
                            Unschedule
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => schedule(card.id)}
                          disabled={busy[card.id]}
                          className="cm-btn cm-btn-primary text-xs"
                        >
                          {busy[card.id] ? '…' : '📅 Give to the MAs'}
                        </button>
                      )}
                    </div>
                  )}

                  {card.schema_beats.length > 0 && (
                    <div className="rounded-xl bg-neutral-50 p-3">
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                        Structure
                      </p>
                      <ol className="flex flex-col gap-1.5">
                        {card.schema_beats.map((b, i) => (
                          <li key={i} className="text-xs text-neutral-700">
                            <span className="font-semibold text-neutral-900">
                              {b.name}
                            </span>
                            {b.text ? ` — ${b.text}` : ''}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {card.template_scaffold && (
                    <details className="rounded-xl border border-neutral-200 p-3">
                      <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                        Template · read more
                      </summary>
                      <pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-relaxed text-neutral-700">
                        {card.template_scaffold}
                      </pre>
                    </details>
                  )}

                  <div className="rounded-xl border border-sky-100 bg-sky-50/40 p-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-sky-600">
                      Your idea
                    </p>
                    {card.idea ? (
                      <>
                        {card.idea.topic && (
                          <p className="mb-1 text-sm font-semibold text-neutral-900">
                            {card.idea.topic}
                          </p>
                        )}
                        {card.idea.hook && (
                          <p className="mb-3 text-sm font-medium text-sky-800">
                            “{card.idea.hook}”
                          </p>
                        )}
                        <RoleScript
                          roleBlocks={card.idea.role_blocks}
                          fallbackScript={card.idea.script}
                        />
                      </>
                    ) : (
                      <p className="text-sm text-neutral-500">
                        No idea yet — generate one.
                      </p>
                    )}
                  </div>

                  {/* Optional tweak — steer the redo ("make it shorter") */}
                  {card.idea && (
                    <input
                      className="cm-input text-xs"
                      placeholder="Want it a bit different? e.g. shorter, more about knees"
                      value={tweaks[card.id] ?? ''}
                      onChange={(e) =>
                        setTweaks((t) => ({ ...t, [card.id]: e.target.value }))
                      }
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => generate(card.id)}
                    disabled={busy[card.id]}
                    className="cm-btn cm-btn-primary w-full text-xs"
                  >
                    {busy[card.id]
                      ? <><SparkleSpinner size={14} /> Thinking…</>
                      : card.idea
                        ? tweaks[card.id]?.trim()
                          ? <><Sparkle size={15} twin /> Redo with this</>
                          : <><Sparkle size={15} twin /> Regenerate idea</>
                        : <><Sparkle size={15} twin /> Generate idea</>}
                  </button>

                  <div className="rounded-xl bg-neutral-50 p-3">
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                      Filming basics
                    </p>
                    <ul className="flex flex-col gap-1 text-xs text-neutral-600">
                      {FILMING_BASICS.map((r) => (
                        <li key={r}>• {r}</li>
                      ))}
                    </ul>
                  </div>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => move(card.id, 'rejected')}
                      disabled={busy[card.id]}
                      className="cm-btn cm-btn-ghost w-full text-xs"
                    >
                      🗑 Move to Trash
                    </button>
                  )}
                </>
              )}

              {/* TRASH — restore or delete forever (admin) */}
              {tab === 'trash' && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => move(card.id, 'candidate')}
                    disabled={busy[card.id]}
                    className="cm-btn cm-btn-ghost flex-1 text-xs"
                  >
                    ↩ Restore
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteForever(card.id)}
                    disabled={busy[card.id]}
                    className="cm-btn cm-btn-danger flex-1 text-xs"
                  >
                    {busy[card.id] ? '…' : '✕ Delete forever'}
                  </button>
                </div>
              )}

              {errors[card.id] && (
                <p className="text-xs text-red-600">{errors[card.id]}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Load more — Discover only, client-side */}
      {tab === 'discover' && discoverVisible < allShown.length && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => setDiscoverVisible((v) => v + 20)}
            className="cm-btn cm-btn-ghost text-sm"
          >
            Load 20 more ({allShown.length - discoverVisible} left)
          </button>
        </div>
      )}

      {/* Upload CTA — only relevant on the Shot List */}
      {tab === 'shotlist' && driveInboxUrl && (
        <div className="mt-2 rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4">
          <p className="text-sm font-semibold text-sky-900">
            Done filming? Upload it here 👇
          </p>
          <p className="mt-1 text-sm text-sky-800">
            Drop your clips into the shared Google Drive inbox — the team picks
            them up from there.
          </p>
          <a
            href={driveInboxUrl}
            target="_blank"
            rel="noreferrer"
            className="cm-btn cm-btn-primary mt-3 inline-flex"
          >
            Open Drive inbox →
          </a>
        </div>
      )}
    </div>
  )
}
