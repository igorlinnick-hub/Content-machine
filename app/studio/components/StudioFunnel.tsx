'use client'

import { useState } from 'react'
import type { RoleBlock } from '@/types'
import { RoleScript } from './RoleScript'

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
  video_url: string | null
  thumbnail_url: string | null
  schema_beats: { name: string; text: string }[]
  template_scaffold: string | null
  idea: StudioCardIdea | null
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
      {card.video_url ? (
        <video
          controls
          playsInline
          preload="metadata"
          poster={card.thumbnail_url ?? undefined}
          className="aspect-[9/16] w-full rounded-xl bg-neutral-900 object-cover"
          src={card.video_url}
        />
      ) : (
        <div className="flex aspect-[9/16] w-full items-center justify-center rounded-xl bg-neutral-100 text-sm text-neutral-400">
          No video
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
}: {
  clinicId: string
  isAdmin: boolean
  initialTab: Tab
  initialCards: StudioCard[]
  driveInboxUrl: string | null
}) {
  const [cards, setCards] = useState(initialCards)
  const [tab, setTab] = useState<Tab>(initialTab)
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [tweaks, setTweaks] = useState<Record<string, string>>({})
  const [addUrl, setAddUrl] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [addMode, setAddMode] = useState<'url' | 'format'>('url')
  const [formatTitle, setFormatTitle] = useState('')
  const [formatDesc, setFormatDesc] = useState('')
  const [shotTypeFilter, setShotTypeFilter] = useState<'all' | 'doctor' | 'clinic'>('all')
  const [discoverVisible, setDiscoverVisible] = useState(20)

  async function addVideo() {
    const url = addUrl.trim()
    if (!url) return
    setAdding(true)
    setAddError(null)
    try {
      const res = await fetch('/api/studio/videos/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId, url }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setAddError(data.error || 'Failed to add')
        return
      }
      setAddUrl('')
      window.location.reload()
    } catch {
      setAddError('Network error')
    } finally {
      setAdding(false)
    }
  }

  async function addFormat() {
    const title = formatTitle.trim()
    if (!title) return
    setAdding(true)
    setAddError(null)
    try {
      const res = await fetch('/api/studio/videos/add-format', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId, title, description: formatDesc.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setAddError(data.error || 'Failed to add')
        return
      }
      setFormatTitle('')
      setFormatDesc('')
      window.location.reload()
    } catch {
      setAddError('Network error')
    } finally {
      setAdding(false)
    }
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
  const allShown = cards.filter((c) => {
    if (c.status !== tabStatus) return false
    if (tab === 'shotlist' && shotTypeFilter !== 'all') return c.shot_type === shotTypeFilter
    return true
  })
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

      {/* Shot List type filter */}
      {tab === 'shotlist' && (
        <div className="flex items-center gap-1.5">
          {(['all', 'doctor', 'clinic'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setShotTypeFilter(f)}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                shotTypeFilter === f
                  ? 'bg-neutral-900 text-white'
                  : 'border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              {f === 'all' ? 'All' : f === 'doctor' ? '👨‍⚕️ Doctor shots' : '🏥 Clinic shots'}
            </button>
          ))}
        </div>
      )}

      {/* Admin: add to the Shot List */}
      {tab === 'shotlist' && isAdmin && (
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
          <div className="mb-2 flex items-center gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Add to Shot List
            </p>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => { setAddMode('url'); setAddError(null) }}
                className={`rounded px-2 py-0.5 text-[11px] font-medium transition ${addMode === 'url' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:text-neutral-800'}`}
              >
                👨‍⚕️ Doctor shot (URL)
              </button>
              <button
                type="button"
                onClick={() => { setAddMode('format'); setAddError(null) }}
                className={`rounded px-2 py-0.5 text-[11px] font-medium transition ${addMode === 'format' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:text-neutral-800'}`}
              >
                🏥 Clinic format
              </button>
            </div>
          </div>

          {addMode === 'url' ? (
            <div className="flex flex-wrap gap-2">
              <input
                className="cm-input min-w-0 flex-1 text-sm"
                placeholder="Paste a TikTok video link…"
                value={addUrl}
                onChange={(e) => { setAddUrl(e.target.value); if (addError) setAddError(null) }}
                onKeyDown={(e) => { if (e.key === 'Enter') addVideo() }}
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
          ) : (
            <div className="flex flex-col gap-2">
              <input
                className="cm-input text-sm"
                placeholder="Format name — e.g. Clinic walk-around"
                value={formatTitle}
                onChange={(e) => { setFormatTitle(e.target.value); if (addError) setAddError(null) }}
              />
              <input
                className="cm-input text-sm"
                placeholder="What to film — e.g. Pan the waiting room, show the team and equipment"
                value={formatDesc}
                onChange={(e) => setFormatDesc(e.target.value)}
              />
              <button
                type="button"
                onClick={addFormat}
                disabled={adding || !formatTitle.trim()}
                className="cm-btn cm-btn-primary text-sm self-start"
              >
                {adding ? 'Adding…' : '➕ Add clinic format'}
              </button>
            </div>
          )}
          {addError && <p className="mt-1 text-xs text-red-600">{addError}</p>}
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
              {!(tab === 'shotlist' && card.shot_type === 'clinic') && <VideoBox card={card} />}
              {tab === 'shotlist' && card.shot_type === 'clinic' && card.title && (
                <p className="text-base font-semibold text-neutral-900">🏥 {card.title}</p>
              )}

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
                      ⭐ Add to Shot List
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

              {/* SHOT LIST — clinic format card (no video, no script) */}
              {tab === 'shotlist' && card.shot_type === 'clinic' && (
                <>
                  {card.style_description && (
                    <div className="rounded-xl bg-teal-50 p-3 text-sm text-teal-900">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-teal-600">What to film</p>
                      <p className="leading-relaxed">{card.style_description}</p>
                    </div>
                  )}
                  <div className="rounded-xl bg-neutral-50 p-3">
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Filming tips</p>
                    <ul className="flex flex-col gap-1 text-xs text-neutral-600">
                      <li>• Phone vertical (9:16), face toward the light</li>
                      <li>• Quiet room, no echo — audio matters</li>
                      <li>• Keep it 20–45 seconds, 2–3 takes</li>
                      <li>• Upload to the Drive folder when done</li>
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

              {/* SHOT LIST — doctor talking-head card (schema + script + generate) */}
              {tab === 'shotlist' && card.shot_type !== 'clinic' && (
                <>
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
                        {card.idea.steps.length > 0 && (
                          <div className="mb-3">
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                              What we&apos;ll film
                            </p>
                            <ol className="ml-4 list-decimal flex flex-col gap-1">
                              {card.idea.steps.map((s, i) => (
                                <li key={i} className="text-xs text-neutral-700">
                                  {s}
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                          Script — who says what
                        </p>
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
                      ? 'Thinking…'
                      : card.idea
                        ? tweaks[card.id]?.trim()
                          ? '✨ Redo with this'
                          : '✨ Regenerate idea'
                        : '✨ Generate idea'}
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
