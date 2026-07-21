/* eslint-disable @next/next/no-img-element */
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PostListItem } from '@/lib/visual/store'
import type { RenderResult, SlideSetStatus } from '@/types'
import { isActivelyMoving, statusMeta } from '@/lib/posts/status-owners'
import { SlideEditor, type UISlide } from './SlideEditor'
import { PhotoPicker } from './PhotoPicker'
import {
  GenerateProgress,
  applyStageEvent,
  emptyProgressState,
  markDone,
  type ProgressState,
} from './GenerateProgress'
import { type StructuredPlanWeek, pillarColor } from '@/lib/content-plan/store'
import { ScheduleModal } from '@/app/components/ScheduleModal'

interface Props {
  clinicId: string
  posts: PostListItem[]
  currentWeek?: StructuredPlanWeek | null
}

interface ComplianceFinding {
  rule: string
  severity: string
  matched?: string | null
  correction?: string | null
}

// Verdict policy (agreed 2026-07-20): only REMOVE surfaces in the UI —
// REWORD/REVIEW/PASS stay silent. Findings live in the DB for audit.
interface ComplianceData {
  grade: 'PASS' | 'REVIEW' | 'REWORD' | 'REMOVE'
  findings: ComplianceFinding[]
  ruleset_version?: string
}

// Written stage-by-stage by the compose orchestrator (migration 045).
// stage 'error' carries the failure reason after a rolled-back run.
interface ComposeProgress {
  stage: string
  ts?: string
  error?: string | null
  hint?: string | null
  generated?: number
  uploaded?: number
}

interface PostDetail {
  slide_set_id: string
  topic: string | null
  hook: string | null
  script: string | null
  slides: UISlide[]
  previews: string[]
  created_at: string
  status: SlideSetStatus
  render_result: RenderResult | null
  compliance: ComplianceData | null
  compose_progress: ComposeProgress | null
  canva_style: 1 | 2
  // Effective Drive folder used by the renderer for body/cta photos.
  // Null when neither slide_set nor category has one — PhotoPicker
  // disables the re-index button in that case.
  drive_folder_id: string | null
  // Per-slide-index override map. Populated by PhotoPicker.
  photo_overrides: Record<string, string | null>
}

interface GenerateResponse {
  slide_set_id: string | null
  script_id: string
  topic: string
  hook: string
  script: string
  slides: UISlide[]
  previews: string[]
  category: { id: string; name: string; emoji: string | null } | null
  pair_id: string | null
  length_target: 'short' | 'long'
}

export function PostsWorkspace({ clinicId, posts: initialPosts, currentWeek }: Props) {
  const router = useRouter()
  const [posts, setPosts] = useState<PostListItem[]>(initialPosts)
  const [selectedId, setSelectedId] = useState<string | null>(
    initialPosts[0]?.slide_set_id ?? null
  )
  const [detail, setDetail] = useState<PostDetail | null>(null)
  const [drafts, setDrafts] = useState<UISlide[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [topic, setTopic] = useState('')
  const [note, setNote] = useState('')
  // plannedPost tracks which plan topic chip is selected (90% path).
  // null = ad-hoc mode (free text); non-null = send planTopicId to the API.
  const [plannedPost, setPlannedPost] = useState<{
    id: string; topic: string; keyword: string | null
    week_number: number; pillar: string
  } | null>(null)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [progress, setProgress] = useState<ProgressState>(emptyProgressState())
  const [composing, setComposing] = useState(false)
  const [composeError, setComposeError] = useState<string | null>(null)
  // Set when the marketer presses Compose so the deadline UX can
  // show "in queue ~2 min" → "longer than usual" without flooding
  // the runner with re-pings. Reset on detail change.
  const [queuedAt, setQueuedAt] = useState<number | null>(null)

  // While generating, tick the client-side elapsedMs every 250ms so
  // the user sees a live counter even between server stage events.
  useEffect(() => {
    if (!generating) return
    const start = Date.now()
    const id = setInterval(() => {
      setProgress((s) => ({ ...s, elapsedMs: Date.now() - start }))
    }, 250)
    return () => clearInterval(id)
  }, [generating])

  // Reset per-post UI state whenever the selected post changes.
  useEffect(() => {
    setQueuedAt(null)
  }, [selectedId])

  // Polling: while the row is actively moving (system/runner working),
  // re-fetch the detail every 4s so the marketer sees status changes
  // without a refresh. Stops automatically when the row settles into
  // a marketer-owned status (visuals_ready / approved / etc).
  useEffect(() => {
    if (!detail) return
    if (!isActivelyMoving(detail.status)) return
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/posts/${detail.slide_set_id}`)
        if (!res.ok) return
        const data = (await res.json()) as PostDetail
        setDetail((d) =>
          d && d.slide_set_id === data.slide_set_id
            ? {
                ...d,
                status: data.status,
                render_result: data.render_result,
                compose_progress: data.compose_progress ?? null,
              }
            : d
        )
        setPosts((prev) =>
          prev.map((p) =>
            p.slide_set_id === data.slide_set_id
              ? {
                  ...p,
                  status: data.status,
                  render_result: data.render_result
                    ? {
                        schema_version: data.render_result.schema_version,
                        canva_edit_url: data.render_result.canva_edit_url,
                        cover_url: data.render_result.outputs?.[0]?.url ?? null,
                        ts: data.render_result.ts,
                      }
                    : null,
                }
              : p
          )
        )
      } catch {
        // poll is best-effort
      }
    }, 4000)
    return () => clearInterval(id)
  }, [detail])

  // PhotoPicker modal state — null = closed; otherwise the index of the
  // slide whose photo is being changed.
  const [photoPickerForIndex, setPhotoPickerForIndex] = useState<number | null>(
    null
  )
  const [scheduleOpen, setScheduleOpen] = useState(false)
  // Recent-posts sidebar collapse — frees the whole width for the
  // slide editor once the marketer has picked a post.
  const [postsCollapsed, setPostsCollapsed] = useState(false)

  // Local copy of the current week's topic chips so reroll / add-more
  // swap chips in place without a page refresh. Topics already turned
  // into posts (status 'done') or skipped don't belong in the picker.
  const [weekPosts, setWeekPosts] = useState<StructuredPlanWeek['posts']>(
    (currentWeek?.posts ?? []).filter((p) => p.status === 'pending')
  )
  const [rerollingTopicId, setRerollingTopicId] = useState<string | null>(null)
  const [addingTopic, setAddingTopic] = useState(false)

  async function rerollPlanTopic(topicId: string) {
    if (rerollingTopicId || addingTopic) return
    setRerollingTopicId(topicId)
    try {
      const res = await fetch('/api/content-plan/reroll', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topicId }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.topic) {
        setWeekPosts((prev) =>
          prev.map((p) =>
            p.id === topicId ? { ...p, topic: data.topic, keyword: data.keyword ?? null } : p
          )
        )
        // The rejected topic may be sitting in the input — clear it.
        if (plannedPost?.id === topicId) {
          setPlannedPost(null)
          setTopic('')
        }
      }
    } finally {
      setRerollingTopicId(null)
    }
  }

  async function addPlanTopic() {
    if (!currentWeek || rerollingTopicId || addingTopic) return
    setAddingTopic(true)
    try {
      const res = await fetch('/api/content-plan/add-topic', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ weekId: currentWeek.id }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.id && data?.topic) {
        setWeekPosts((prev) => [
          ...prev,
          {
            id: data.id,
            topic: data.topic,
            keyword: data.keyword ?? null,
            format: data.format ?? null,
            position: data.position ?? prev.length,
            status: 'pending',
          },
        ])
      }
    } finally {
      setAddingTopic(false)
    }
  }

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      setDrafts([])
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    setDetail(null)
    ;(async () => {
      try {
        const res = await fetch(`/api/posts/${selectedId}`)
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
        setDetail(data as PostDetail)
        setDrafts(((data as PostDetail).slides ?? []).slice())
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedId])

  async function generate() {
    if (!topic.trim()) {
      setGenError('Topic required')
      return
    }
    setGenerating(true)
    setGenError(null)
    setProgress(emptyProgressState())

    try {
      const res = await fetch('/api/posts/generate?stream=1', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clinicId,
          // Planned (90%): send the plan topic id so Writer gets pillar/theme/keyword context.
          // Ad-hoc (10%): send raw topic text.
          ...(plannedPost
            ? { planTopicId: plannedPost.id }
            : { topic: topic.trim() }),
          note: note.trim() || undefined,
        }),
      })

      if (!res.ok || !res.body) {
        // Most likely an early validation / kill-switch response: it's
        // JSON, not a stream. Parse and throw.
        let errMsg = `HTTP ${res.status}`
        try {
          const data = await res.json()
          if (
            res.status === 503 &&
            (data?.error === 'LLM_AGENTS_DISABLED' || data?.ok === false)
          ) {
            errMsg = 'LLM_AGENTS_DISABLED'
          } else if (data?.error) {
            errMsg = data.error
          }
        } catch {
          // ignore — body not JSON, keep HTTP status message
        }
        throw new Error(errMsg)
      }

      // Stream parser. SSE frames are double-newline separated, each
      // frame has lines like "event: <name>\ndata: <json>". We
      // accumulate buffer and flush whole frames as they arrive.
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let result: GenerateResponse | null = null
      let streamError: string | null = null

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // Split on double newline — anything before the last \n\n is a
        // complete frame, the trailing tail goes back into the buffer.
        const frames = buffer.split('\n\n')
        buffer = frames.pop() ?? ''
        for (const frame of frames) {
          if (!frame.trim()) continue
          let evName = 'message'
          let dataLine = ''
          for (const line of frame.split('\n')) {
            if (line.startsWith('event: ')) evName = line.slice(7).trim()
            else if (line.startsWith('data: ')) dataLine = line.slice(6)
          }
          if (!dataLine) continue
          let payload: unknown
          try {
            payload = JSON.parse(dataLine)
          } catch {
            continue
          }
          if (evName === 'stage') {
            const p = payload as { name?: string; elapsed_ms?: number }
            if (typeof p?.name === 'string') {
              setProgress((s) =>
                applyStageEvent(s, p.name as string, p.elapsed_ms ?? s.elapsedMs)
              )
            }
          } else if (evName === 'done') {
            result = payload as GenerateResponse
            setProgress((s) => markDone(s, s.elapsedMs))
          } else if (evName === 'error') {
            streamError = (payload as { error?: string })?.error ?? 'failed'
          }
        }
      }

      if (streamError) throw new Error(streamError)
      if (!result) throw new Error('Stream ended without result')

      const fresh = result
      if (fresh.slide_set_id) {
        const newItem: PostListItem = {
          slide_set_id: fresh.slide_set_id,
          script_id: fresh.script_id,
          topic: fresh.topic,
          hook: fresh.hook,
          script: fresh.script,
          slide_count: fresh.slides.length,
          status: 'rendered',
          created_at: new Date().toISOString(),
          length_target: fresh.length_target,
          pair_id: fresh.pair_id,
          category: fresh.category,
          render_result: null,
        }
        setPosts((prev) => [newItem, ...prev])
        setSelectedId(fresh.slide_set_id)
        setDetail({
          slide_set_id: fresh.slide_set_id,
          topic: fresh.topic,
          hook: fresh.hook,
          script: fresh.script,
          slides: fresh.slides,
          previews: fresh.previews,
          created_at: newItem.created_at,
          status: 'review',
          render_result: null,
          compose_progress: null,
          compliance: null,
          canva_style: 1,
          drive_folder_id: null,
          photo_overrides: {},
        })
        setDrafts(fresh.slides.slice())
        setLoading(false)
        // Pull the real status — the server may already be auto-composing
        // (PASS → in_canva) and the poll loop should pick that up.
        void reloadDetail(fresh.slide_set_id)
      }
      // The planned topic became a post — the server marked it 'done';
      // drop its chip from the picker immediately.
      if (plannedPost) {
        setWeekPosts((prev) => prev.filter((p) => p.id !== plannedPost.id))
        setPlannedPost(null)
      }
      setTopic('')
      setNote('')
      router.refresh()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'failed to generate'
      setGenError(msg)
      setProgress((s) => ({ ...s, error: msg }))
    } finally {
      setGenerating(false)
    }
  }

  async function save() {
    if (!selectedId) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/posts/${selectedId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slides: drafts }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      setDetail((d) =>
        d
          ? { ...d, slides: data.slides ?? d.slides, previews: data.previews ?? d.previews }
          : d
      )
      setDrafts((data.slides as UISlide[]).slice())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to save')
    } finally {
      setSaving(false)
    }
  }

  // Re-fetch post detail. Called by PhotoPicker after a successful
  // pick, and right after generation (the server may have auto-queued
  // the Canva compose — the client's optimistic 'review' would hide it).
  async function reloadDetail(id?: string) {
    const targetId = id ?? selectedId
    if (!targetId) return
    try {
      const res = await fetch(`/api/posts/${targetId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      setDetail(data as PostDetail)
      setDrafts(((data as PostDetail).slides ?? []).slice())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to refresh')
    }
  }

  async function handleStyleChange(s: 1 | 2) {
    if (!detail || detail.canva_style === s) return
    setDetail((d) => (d ? { ...d, canva_style: s } : d))
    await fetch(`/api/posts/${detail.slide_set_id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ canva_style: s }),
    }).catch(() => null)
  }

  async function remove() {
    if (!selectedId) return
    if (!confirm('Delete this post permanently?')) return
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/posts/${selectedId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? `HTTP ${res.status}`)
      }
      const remaining = posts.filter((p) => p.slide_set_id !== selectedId)
      setPosts(remaining)
      setSelectedId(remaining[0]?.slide_set_id ?? null)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  const dirty =
    detail !== null &&
    (drafts.length !== detail.slides.length ||
      drafts.some((s, i) => {
        const o = detail.slides[i]
        return (
          !o ||
          s.kind !== o.kind ||
          s.text !== o.text ||
          (s.chip ?? null) !== (o.chip ?? null) ||
          (s.subtext ?? null) !== (o.subtext ?? null)
        )
      }))

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl border border-sky-200 bg-sky-50 p-5 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">
          New post
        </p>
        <div className="mt-3 flex flex-col gap-3">
          {/* Current week suggestion strip */}
          {currentWeek && (() => {
            const color = pillarColor(currentWeek.pillar)
            return (
              <div
                className="flex flex-col gap-2 rounded-xl border p-3"
                style={{ background: `${color}08`, borderColor: `${color}25` }}
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">
                    Week {currentWeek.week_number}
                  </span>
                  <span className="text-[12px] font-semibold text-neutral-700">{currentWeek.theme}</span>
                  <span className="text-[11px] text-neutral-400">{currentWeek.pillar}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {weekPosts.map((post) => {
                    const isSelected = plannedPost?.id === post.id
                    const isRerolling = rerollingTopicId === post.id
                    return (
                      <div
                        key={post.id}
                        className="flex items-center overflow-hidden rounded-lg"
                        style={{
                          background: isSelected ? `${color}28` : `${color}14`,
                          border: `1px solid ${isSelected ? color : `${color}25`}`,
                          opacity: isRerolling ? 0.6 : 1,
                        }}
                      >
                        <button
                          type="button"
                          disabled={generating || isRerolling}
                          onClick={() => {
                            setPlannedPost({ id: post.id, topic: post.topic, keyword: post.keyword, week_number: currentWeek.week_number, pillar: currentWeek.pillar })
                            setTopic(post.topic)
                          }}
                          className="px-2.5 py-1 text-[11px] font-medium transition hover:opacity-80 disabled:opacity-50"
                          style={{ color, fontWeight: isSelected ? 600 : undefined }}
                        >
                          {isRerolling ? 'Generating new topic…' : post.topic}
                        </button>
                        <button
                          type="button"
                          disabled={generating || rerollingTopicId !== null || addingTopic}
                          onClick={() => rerollPlanTopic(post.id)}
                          title="Replace this topic with a freshly generated one (same week + theme)"
                          className="px-1.5 py-1 text-[11px] opacity-50 transition hover:opacity-100 disabled:opacity-30"
                          style={{ color }}
                        >
                          ↻
                        </button>
                      </div>
                    )
                  })}
                  <button
                    type="button"
                    disabled={generating || addingTopic || rerollingTopicId !== null}
                    onClick={addPlanTopic}
                    title="Generate one more topic for this week"
                    className="rounded-lg border border-dashed px-2.5 py-1 text-[11px] font-medium transition hover:opacity-80 disabled:opacity-50"
                    style={{ color, borderColor: `${color}55`, background: 'transparent' }}
                  >
                    {addingTopic ? 'Generating…' : '+ Add more'}
                  </button>
                </div>
              </div>
            )
          })()}
          <div className="flex flex-col gap-1">
            <input
              type="text"
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value)
                // If user edits the text away from a planned topic, switch to ad-hoc mode
                if (plannedPost && e.target.value !== plannedPost.topic) setPlannedPost(null)
              }}
              placeholder="Topic — e.g. ketamine for treatment-resistant depression"
              className="cm-input text-sm"
              disabled={generating}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !generating && (e.metaKey || e.ctrlKey)) generate()
              }}
            />
            {plannedPost ? (
              <p className="text-[11px] text-emerald-600">
                📅 Planned · Week {plannedPost.week_number} · {plannedPost.pillar}
                {plannedPost.keyword ? ` · keyword "${plannedPost.keyword}"` : ''}
              </p>
            ) : topic.trim() ? (
              <p className="text-[11px] text-neutral-400">✏️ Custom topic — ad-hoc mode</p>
            ) : null}
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional starting note — paste any rough thoughts, a key fact, the angle you want. Leave blank to let the team pick."
            rows={3}
            className="cm-input resize-none text-sm"
            disabled={generating}
          />
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={generate}
              disabled={generating || !topic.trim()}
              className="cm-btn cm-btn-primary text-sm"
            >
              {generating ? 'Generating…' : 'Generate'}
            </button>
          </div>
          {generating && <GenerateProgress state={progress} />}
          {genError === 'LLM_AGENTS_DISABLED' ? (
            <div className="rounded border border-sky-200 bg-sky-50 px-3 py-3 text-xs text-sky-800">
              <p className="mb-1 font-semibold">
                Post generation is on subscription-pause
              </p>
              <p className="text-[11px] leading-relaxed">
                The web app is running in subscription-only mode — daily work
                (arsenal, manual photo picks, editing) stays free. New
                carousels generate on <strong>batch day</strong> when{' '}
                <code className="rounded bg-sky-100 px-1">
                  ENABLE_LLM_AGENTS=true
                </code>{' '}
                is flipped in Vercel env vars. For urgent posts use the arsenal
                flow.
              </p>
            </div>
          ) : (
            genError && (
              <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {genError}
              </p>
            )
          )}
        </div>
      </section>

      <div
        className={`grid min-h-[calc(100vh-280px)] grid-cols-1 gap-5 ${
          postsCollapsed ? '' : 'lg:grid-cols-[260px_minmax(0,1fr)]'
        }`}
      >
        {/* Sidebar — hidden entirely when collapsed; no awkward 52px strip */}
        {!postsCollapsed && (
          <aside className="cm-card flex max-h-[calc(100vh-280px)] flex-col overflow-hidden">
            <header className="flex items-start justify-between border-b border-neutral-200 px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-500">
                  Recent posts
                </p>
                <p className="text-xs text-neutral-500">{posts.length} total</p>
              </div>
              <button
                type="button"
                onClick={() => setPostsCollapsed(true)}
                title="Hide the list"
                className="rounded-lg border border-neutral-200 px-2 py-1 text-xs text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-700"
              >
                ◂
              </button>
            </header>
            {posts.length === 0 ? (
              <p className="p-4 text-sm text-neutral-500">No posts yet.</p>
            ) : (
              <ul className="flex-1 overflow-y-auto">
                {posts.map((p) => {
                  const active = p.slide_set_id === selectedId
                  return (
                    <li key={p.slide_set_id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(p.slide_set_id)}
                        className={`w-full border-b border-neutral-200 px-4 py-3 text-left transition ${
                          active ? 'bg-sky-50' : 'hover:bg-neutral-50'
                        }`}
                      >
                        <p
                          className={`line-clamp-2 text-sm font-medium ${
                            active ? 'text-sky-900' : 'text-neutral-900'
                          }`}
                        >
                          {p.topic ?? 'Untitled'}
                        </p>
                        <p className="mt-0.5 text-xs text-neutral-500">
                          {formatDate(p.created_at)} · {p.slide_count} slides
                        </p>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </aside>
        )}

        <section className="flex min-w-0 flex-col gap-5">
          {/* Expand button — only visible when sidebar is hidden */}
          {postsCollapsed && (
            <div>
              <button
                type="button"
                onClick={() => setPostsCollapsed(false)}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-700"
              >
                <span>▸</span>
                <span>Posts · {posts.length}</span>
              </button>
            </div>
          )}
          {!selectedId ? (
            <div className="cm-card flex flex-1 items-center justify-center p-8 text-sm text-neutral-500">
              Generate a post above — it will open here.
            </div>
          ) : loading ? (
            <div className="cm-card flex flex-1 items-center justify-center p-8 text-sm text-neutral-500">
              Loading post…
            </div>
          ) : !detail ? (
            <div className="cm-card flex flex-1 items-center justify-center p-8 text-sm text-red-600">
              {error ?? 'Failed to load post.'}
            </div>
          ) : (
            <>
              <header className="flex flex-col gap-3 border-b border-neutral-200 pb-4">
                {/* Title row */}
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold text-neutral-900">
                        {detail.topic ?? 'Untitled post'}
                      </h2>
                      <StatusChip status={detail.status} />
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">
                      {formatDate(detail.created_at)} · {detail.slides.length} slides
                    </p>
                    {/* Only a hard REMOVE surfaces — everything else is silent */}
                    {detail.compliance?.grade === 'REMOVE' && (
                      <div className="mt-2 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
                        <span className="text-sm font-bold text-red-500">✕</span>
                        <span className="text-xs font-semibold text-red-800">
                          Cannot publish — medical director review required
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action buttons — fixed layout, never wraps */}
                <div className="flex flex-col gap-2 sm:items-end">
                  {/* Compose waiting chip — rendered ABOVE the button row so it
                      never pushes Schedule out of alignment */}
                  {(detail.status === 'ready_for_canva' || detail.status === 'in_canva') && (
                    <div className="flex flex-wrap items-center gap-2">
                      <ComposeWaitingChip
                        status={detail.status}
                        queuedAt={queuedAt}
                        progress={detail.compose_progress}
                      />
                      {detail.status === 'ready_for_canva' && (
                        <button
                          type="button"
                          onClick={async () => {
                            setComposing(true)
                            setComposeError(null)
                            try {
                              const res = await fetch(`/api/posts/${detail.slide_set_id}/compose`, { method: 'POST' })
                              const data = await res.json().catch(() => ({}))
                              if (!res.ok) throw new Error((data as {error?: string})?.error ?? `Compose failed (HTTP ${res.status})`)
                              setQueuedAt(Date.now())
                              setDetail((d) => d ? { ...d, status: 'in_canva' as SlideSetStatus } : d)
                              setPosts((prev) => prev.map((p) => p.slide_set_id === detail.slide_set_id ? { ...p, status: 'in_canva' as SlideSetStatus } : p))
                            } catch (e) {
                              setComposeError(e instanceof Error ? e.message : 'compose failed')
                            } finally {
                              setComposing(false)
                            }
                          }}
                          disabled={composing}
                          className="cm-btn cm-btn-ghost text-xs"
                          title="Skip the queue — compose right now"
                        >
                          {composing ? 'Starting…' : '⚡ Start now'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/posts/${detail.slide_set_id}/compose`, { method: 'DELETE' })
                            if (!res.ok) return
                            setQueuedAt(null)
                            setDetail((d) => d ? { ...d, status: 'review' as SlideSetStatus, compose_progress: null } : d)
                            setPosts((prev) => prev.map((p) => p.slide_set_id === detail.slide_set_id ? { ...p, status: 'review' as SlideSetStatus } : p))
                          } catch {
                            // poll will catch up
                          }
                        }}
                        className="cm-btn cm-btn-ghost text-xs text-red-600"
                        title="Stop this compose — the post goes back to Ready to compose"
                      >
                        ■ Stop
                      </button>
                    </div>
                  )}

                  {/* Last compose failed — persistent reason from the server */}
                  {detail.status === 'review' && detail.compose_progress?.stage === 'error' && (
                    <p className="max-w-md rounded border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] text-red-700">
                      Last compose failed: {detail.compose_progress.error ?? 'unknown error'}
                      {detail.compose_progress.hint ? ` — ${detail.compose_progress.hint}` : ''}
                    </p>
                  )}

                  {/* Primary row: style + compose + schedule + save — always same height */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center rounded-xl border border-slate-200 bg-white/60 p-0.5">
                      {([1, 2] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => handleStyleChange(s)}
                          className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                            (detail.canva_style ?? 1) === s
                              ? 'bg-violet-600 text-white shadow-sm'
                              : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          Style {s}
                        </button>
                      ))}
                    </div>
                    <ComposeInCanvaButton
                      slideSetId={detail.slide_set_id}
                      status={detail.status}
                      renderResult={detail.render_result}
                      composing={composing}
                      queuedAt={queuedAt}
                      onCompose={async () => {
                        setComposing(true)
                        setComposeError(null)
                        try {
                          const res = await fetch(
                            `/api/posts/${detail.slide_set_id}/compose`,
                            { method: 'POST' }
                          )
                          const data = await res.json().catch(() => ({}))
                          if (!res.ok) {
                            throw new Error(
                              (data as {error?: string})?.error ?? `Compose failed (HTTP ${res.status})`
                            )
                          }
                          setQueuedAt(Date.now())
                          setDetail((d) =>
                            d
                              ? { ...d, status: 'in_canva' as SlideSetStatus, compose_progress: null }
                              : d
                          )
                          setPosts((prev) =>
                            prev.map((p) =>
                              p.slide_set_id === detail.slide_set_id
                                ? { ...p, status: 'in_canva' as SlideSetStatus }
                                : p
                            )
                          )
                        } catch (e) {
                          setComposeError(
                            e instanceof Error ? e.message : 'compose failed'
                          )
                        } finally {
                          setComposing(false)
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setScheduleOpen(true)}
                      className="cm-btn text-sm font-semibold"
                      style={{ background: '#0EA5E9', color: 'white', border: 'none' }}
                    >
                      Schedule
                    </button>
                    {dirty && (
                      <button
                        type="button"
                        onClick={save}
                        disabled={saving}
                        className="cm-btn cm-btn-primary text-sm"
                      >
                        {saving ? 'Saving…' : 'Save & re-render'}
                      </button>
                    )}
                  </div>
                  {/* Secondary row: download + delete */}
                  <div className="flex items-center gap-2">
                    <a
                      href={`/api/visual/download?slideSetId=${detail.slide_set_id}`}
                      className="cm-btn cm-btn-ghost text-sm"
                    >
                      Download PNG
                    </a>
                    <button
                      type="button"
                      onClick={remove}
                      disabled={deleting}
                      className="cm-btn cm-btn-ghost text-sm text-red-600"
                    >
                      {deleting ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
              </header>

              {composeError && (
                <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  Compose in Canva: {composeError}
                </p>
              )}

              {error && (
                <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </p>
              )}

              <ul className="flex flex-col gap-3">
                {drafts.map((slide, i) => (
                  <SlideEditor
                    key={i}
                    slideSetId={detail.slide_set_id}
                    index={i}
                    slide={slide}
                    preview={detail.previews?.[i] ?? null}
                    onSlideChange={(next) => {
                      const arr = drafts.slice()
                      arr[i] = next
                      setDrafts(arr)
                    }}
                    onChangePhoto={
                      slide.kind === 'cover'
                        ? undefined
                        : () => setPhotoPickerForIndex(i)
                    }
                  />
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      {detail && photoPickerForIndex !== null && (
        <PhotoPicker
          clinicId={clinicId}
          slideSetId={detail.slide_set_id}
          slideIndex={photoPickerForIndex}
          driveFolderId={detail.drive_folder_id}
          currentFileId={
            detail.photo_overrides?.[String(photoPickerForIndex)] ?? null
          }
          onClose={() => setPhotoPickerForIndex(null)}
          onPicked={reloadDetail}
        />
      )}

      {detail && (
        <ScheduleModal
          open={scheduleOpen}
          onClose={() => setScheduleOpen(false)}
          clinicId={clinicId}
          slideSetId={detail.slide_set_id}
          initialCaption={detail.hook ? `${detail.topic ?? ''}\n\n${detail.hook}` : (detail.topic ?? '')}
          initialMediaUrl={detail.render_result?.outputs?.[0]?.url ?? ''}
          onSaved={() => {
            // Close after short delay so user can see result
            setTimeout(() => setScheduleOpen(false), 1800)
          }}
        />
      )}
    </div>
  )
}

// Live indicator while the row sits in ready_for_canva / in_canva.
// The label is REAL: the orchestrator writes compose_progress to the DB
// stage-by-stage and the 4s poll delivers it here — no simulated phase
// cycling. Elapsed counts from the current stage's server timestamp, so
// it survives reloads and never "restarts" on return.
const STAGE_LABELS: Record<string, string> = {
  load: 'Loading slides',
  photos: 'Generating slide photos',
  upload: 'Uploading photos to Canva',
  autofill: 'Filling the brand template',
  save: 'Saving result',
}

function composeStageLabel(progress: ComposeProgress | null, status: SlideSetStatus): string {
  if (!progress?.stage || progress.stage === 'error') {
    return status === 'in_canva' ? 'Composing in Canva' : 'Waiting for compose to start'
  }
  const key = progress.stage.split(':')[0]
  const base = STAGE_LABELS[key] ?? progress.stage
  const counts =
    typeof progress.generated === 'number'
      ? ` (${progress.generated} photos)`
      : typeof progress.uploaded === 'number'
        ? ` (${progress.uploaded} uploaded)`
        : ''
  return base + counts
}

function ComposeWaitingChip({
  status,
  queuedAt,
  progress,
}: {
  status: SlideSetStatus
  queuedAt: number | null
  progress: ComposeProgress | null
}) {
  const [, forceTick] = useState(0)

  // Elapsed truth-source, best first: the server timestamp of the
  // current stage → the click moment in this session → chip mount.
  const mountRef = useRef<number>(Date.now())
  const stageTs = progress?.ts ? Date.parse(progress.ts) : NaN
  const start = Number.isFinite(stageTs)
    ? stageTs
    : queuedAt ?? mountRef.current

  // 1s tick to keep the elapsed counter live without depending on
  // poll-driven re-renders.
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const label = composeStageLabel(progress, status)
  const elapsedMs = Date.now() - start
  const elapsedLabel = formatElapsed(elapsedMs)
  const inStage = Number.isFinite(stageTs)
  const slow = elapsedMs > 5 * 60_000

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="cm-shimmer-host flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold"
        style={{
          background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 55%, #0ea5e9 100%)',
          color: 'white',
          minWidth: '15rem',
        }}
      >
        <span
          aria-hidden
          className="cm-dot-blink inline-block h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: '#bae6fd', boxShadow: '0 0 0 3px rgba(186, 230, 253, 0.25)' }}
        />
        <span className="relative z-10 flex flex-col leading-tight">
          <span key={label} className="cm-fade-swap">
            🎨 {label}…
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-violet-100/90">
            {inStage ? `${elapsedLabel} in this step` : `${elapsedLabel} elapsed`} · est. ~2 min total
          </span>
        </span>
      </div>
      {slow && (
        <span className="text-[10px] text-amber-700">
          ⚠ This step is taking unusually long — press Stop to bail out and
          get the Compose button back.
        </span>
      )}
    </div>
  )
}

function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}m ${r.toString().padStart(2, '0')}s`
}

function StatusChip({ status }: { status: SlideSetStatus }) {
  const meta = statusMeta(status)
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${meta.chipClass}`}
      title={meta.hint}
    >
      {meta.label}
    </span>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// State-machine driven button. Mirrors the runner contract from
// HANDOFF-POSTS.md §22 + status-owners.ts:
//   blocked         → disabled (compliance fix first)
//   ready_for_canva → "Queued for Canva…" + deadline UX (≤2min normal,
//                     >10min "longer than usual" hint)
// Fetches a fresh Canva URL per click — stored edit links expire ~30d.
// On Canva API 404 (design deleted): shows inline "Re-compose" prompt.
// On other errors: shows inline error text with Re-compose fallback.
function OpenInCanvaButton({
  slideSetId,
  composing,
  onCompose,
}: {
  slideSetId: string
  composing: boolean
  onCompose: () => void
}) {
  const [opening, setOpening] = useState(false)
  const [canvaError, setCanvaError] = useState<string | null>(null)

  async function handleOpen() {
    setOpening(true)
    setCanvaError(null)
    try {
      const res = await fetch(`/api/posts/${slideSetId}/canva`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setCanvaError(
          (data as { message?: string }).message ??
            'Cannot open Canva — use Re-compose'
        )
        return
      }
      const url = (data as { url?: string }).url
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      setCanvaError('Canva unreachable — try again')
    } finally {
      setOpening(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleOpen}
          disabled={opening || composing}
          className="cm-btn text-sm font-semibold"
          style={{
            background: opening
              ? '#a78bfa'
              : 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)',
            color: 'white',
          }}
        >
          {opening ? 'Opening…' : '🎨 Open in Canva ↗'}
        </button>
        <button
          type="button"
          onClick={() => { setCanvaError(null); onCompose() }}
          disabled={composing}
          className="cm-btn cm-btn-ghost text-sm"
          title="Discard the current visuals and recompose from scratch"
        >
          {composing ? 'Re-composing…' : 'Re-compose'}
        </button>
      </div>
      {canvaError && (
        <p className="text-[11px] text-amber-700">{canvaError}</p>
      )}
    </div>
  )
}

//   in_canva        → "Drawing carousel…"
//   visuals_ready   → "🎨 Open in Canva ↗" + (caller will add Approve)
//   approved/etc    → "Re-compose" (allows regenerate)
//   pending/review  → "🎨 Compose in Canva" (primary action)
function ComposeInCanvaButton({
  slideSetId,
  status,
  renderResult,
  composing,
  queuedAt,
  onCompose,
}: {
  slideSetId: string
  status: SlideSetStatus
  renderResult: RenderResult | null
  composing: boolean
  queuedAt: number | null
  onCompose: () => void
}) {
  if (status === 'blocked') {
    return (
      <button
        type="button"
        disabled
        title="Compliance blocked this post — fix the findings first"
        className="cm-btn cm-btn-ghost text-sm opacity-60"
      >
        🎨 Compose in Canva
      </button>
    )
  }

  if (status === 'ready_for_canva' || status === 'in_canva') {
    // The full ComposeWaitingChip is rendered ABOVE the button row by the
    // parent — this slot stays compact so Schedule/Save stay on the same line.
    return (
      <span className="text-xs font-medium text-violet-500">
        {status === 'in_canva' ? 'In Canva…' : 'Queued…'}
      </span>
    )
  }

  if (renderResult?.canva_edit_url) {
    return <OpenInCanvaButton slideSetId={slideSetId} composing={composing} onCompose={onCompose} />
  }

  return (
    <button
      type="button"
      onClick={onCompose}
      disabled={composing}
      className="cm-btn text-sm font-semibold"
      style={{
        background: composing
          ? '#a78bfa'
          : 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)',
        color: 'white',
      }}
    >
      {composing ? 'Queuing…' : '🎨 Compose in Canva'}
    </button>
  )
}
