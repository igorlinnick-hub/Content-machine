'use client'

import { useState } from 'react'
import type { RoleBlock } from '@/types'
import { RoleScript } from './RoleScript'

type Status = 'candidate' | 'liked' | 'shotlist' | 'rejected'
type Tab = 'discover' | 'liked' | 'shotlist'

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
  account: string | null
  view_count: number | null
  title: string | null
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

const TABS: { key: Tab; label: string; status: Status }[] = [
  { key: 'discover', label: 'Discover', status: 'candidate' },
  { key: 'liked', label: 'Liked', status: 'liked' },
  { key: 'shotlist', label: 'Shot List', status: 'shotlist' },
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

  async function generate(id: string) {
    setBusyFor(id, true)
    setErrorFor(id, null)
    try {
      const res = await fetch(`/api/studio/videos/${id}/generate-idea`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId }),
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

  const shown = cards.filter((c) => c.status === TABS.find((t) => t.key === tab)!.status)
  const countFor = (s: Status) => cards.filter((c) => c.status === s).length

  return (
    <div className="flex flex-col gap-5">
      {/* Tabs */}
      <nav className="flex flex-wrap gap-1.5 border-b border-neutral-200 pb-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              tab === t.key
                ? 'bg-neutral-900 text-white'
                : 'border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            {t.label} ({countFor(t.status)})
          </button>
        ))}
      </nav>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-12 text-center text-sm text-neutral-600">
          {tab === 'discover' && 'No new reels to review. Add some to the base.'}
          {tab === 'liked' && 'Nothing liked yet. Like reels in Discover.'}
          {tab === 'shotlist' &&
            (isAdmin
              ? 'Shot List is empty. Promote liked reels here.'
              : 'Shot List is empty. The admin sets what we film.')}
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
              className={`flex shrink-0 flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm ${
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
                    className="cm-btn cm-btn-primary flex-1 text-xs"
                  >
                    👍 Like
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

              {/* SHOT LIST — schema + template + idea + generate */}
              {tab === 'shotlist' && (
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

                  <button
                    type="button"
                    onClick={() => generate(card.id)}
                    disabled={busy[card.id]}
                    className="cm-btn cm-btn-primary w-full text-xs"
                  >
                    {busy[card.id]
                      ? 'Thinking…'
                      : card.idea
                        ? '✨ Regenerate idea'
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
                      onClick={() => move(card.id, 'liked')}
                      disabled={busy[card.id]}
                      className="cm-btn cm-btn-ghost w-full text-xs"
                    >
                      Remove from Shot List
                    </button>
                  )}
                </>
              )}

              {errors[card.id] && (
                <p className="text-xs text-red-600">{errors[card.id]}</p>
              )}
            </div>
          ))}
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
