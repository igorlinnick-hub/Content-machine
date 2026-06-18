/* eslint-disable @next/next/no-img-element */
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PostListItem, RenderResultSummary } from '@/lib/visual/store'
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

interface Props {
  clinicId: string
  posts: PostListItem[]
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

export function PostsWorkspace({ clinicId, posts: initialPosts }: Props) {
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

  // Reset the queue-since timer whenever the selected post changes —
  // otherwise the deadline UX would say "queued 5min" for a fresh row
  // I just clicked into.
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
            ? { ...d, status: data.status, render_result: data.render_result }
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
          topic: topic.trim(),
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
          drive_folder_id: null,
          photo_overrides: {},
        })
        setDrafts(fresh.slides.slice())
        setLoading(false)
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
  // pick so previews + photo_overrides are fresh on screen.
  async function reloadDetail() {
    if (!selectedId) return
    try {
      const res = await fetch(`/api/posts/${selectedId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      setDetail(data as PostDetail)
      setDrafts(((data as PostDetail).slides ?? []).slice())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to refresh')
    }
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
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Topic — e.g. ketamine for treatment-resistant depression"
            className="cm-input text-sm"
            disabled={generating}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !generating && (e.metaKey || e.ctrlKey)) generate()
            }}
          />
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional starting note — paste any rough thoughts, a key fact, the angle you want. Leave blank to let the team pick."
            rows={3}
            className="cm-input resize-none text-sm"
            disabled={generating}
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-neutral-600">
              Writer + critic + slide splitter run on the backend. ~3-5 min for a finished carousel.
            </p>
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
                flow in Telegram.
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

      <div className="grid min-h-[calc(100vh-280px)] grid-cols-1 gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="cm-card flex max-h-[calc(100vh-280px)] flex-col overflow-hidden">
          <header className="border-b border-neutral-200 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-500">
              Recent posts
            </p>
            <p className="text-xs text-neutral-500">{posts.length} total</p>
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

        <section className="flex min-w-0 flex-col gap-5">
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
              <header className="flex flex-col gap-3 border-b border-neutral-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
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
                  <p className="mt-1 text-xs text-neutral-500">
                    {statusMeta(detail.status).hint}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ComposeInCanvaButton
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
                            data?.error ?? `Compose failed (HTTP ${res.status})`
                          )
                        }
                        setQueuedAt(Date.now())
                        // Optimistically flip to ready_for_canva — the
                        // poll loop will pick up further status changes.
                        setDetail((d) =>
                          d
                            ? { ...d, status: 'ready_for_canva' as SlideSetStatus }
                            : d
                        )
                        setPosts((prev) =>
                          prev.map((p) =>
                            p.slide_set_id === detail.slide_set_id
                              ? { ...p, status: 'ready_for_canva' as SlideSetStatus }
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
                    preview={detail.previews[i] ?? null}
                    onSlideChange={(next) => {
                      const arr = drafts.slice()
                      arr[i] = next
                      setDrafts(arr)
                    }}
                    onAIFix={({ slide: nextSlide, preview }) => {
                      const arr = drafts.slice()
                      arr[i] = nextSlide
                      setDrafts(arr)
                      setDetail((d) => {
                        if (!d) return d
                        const slides = d.slides.slice()
                        slides[i] = nextSlide
                        const previews = d.previews.slice()
                        previews[i] = preview
                        return { ...d, slides, previews }
                      })
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
    </div>
  )
}

// Live waiting indicator while the row sits in ready_for_canva /
// in_canva. Three liveness signals at once so the marketer never
// stares at a frozen pill:
//   • Pulsing dot (HWC sky-blue heartbeat — distinct from Claude's
//     amber Accomplishing-cursor).
//   • Cross-faded phase text that rotates through the runner's actual
//     pipeline ("Waking the runner…" → "Generating photos…" → etc).
//     We don't know which phase the runner is in (no SSE from the bot
//     yet), so we cycle on a fixed cadence — illusion of progress is
//     fine here, and the cycle resets to phase 1 once 'in_canva'
//     fires so the words sync with real state changes when we have
//     them.
//   • Diagonal shimmer sweeping across the chip background.
// Elapsed counter is the truth-source — bypasses the "is it stuck?"
// question. After 10 minutes we surface a "runner may be down" hint.
const QUEUE_PHASES = [
  'Queueing for Canva runner',
  'Waking the runner',
  'Generating slide photos',
  'Uploading assets to Canva',
  'Filling the brand template',
]
const IN_CANVA_PHASES = [
  'Filling the brand template',
  'Generating slide photos',
  'Uploading assets to Canva',
  'Composing slides in Canva',
  'Finalising preview',
]

function ComposeWaitingChip({
  status,
  queuedAt,
}: {
  status: SlideSetStatus
  queuedAt: number | null
}) {
  const [phaseIdx, setPhaseIdx] = useState(0)
  const [, forceTick] = useState(0)
  const phases = status === 'in_canva' ? IN_CANVA_PHASES : QUEUE_PHASES
  const phase = phases[phaseIdx % phases.length]

  // Truth-source for elapsed: queuedAt (when the marketer clicked
  // Compose in this session) if present, else when this chip first
  // mounted. Lets the counter survive a page refresh — if the row
  // was already queued, we honestly show "since you opened this".
  const startRef = useRef<number>(queuedAt ?? Date.now())
  useEffect(() => {
    if (queuedAt && queuedAt !== startRef.current) {
      startRef.current = queuedAt
    }
  }, [queuedAt])

  // Rotate the phase label every ~4s. Reset to 0 on status change so
  // 'in_canva' starts its own cycle rather than continuing from where
  // 'ready_for_canva' left off.
  useEffect(() => {
    setPhaseIdx(0)
    const id = setInterval(() => {
      setPhaseIdx((i) => i + 1)
    }, 4000)
    return () => clearInterval(id)
  }, [status])

  // 1s tick to keep the elapsed counter live without depending on
  // poll-driven re-renders.
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const elapsedMs = Date.now() - startRef.current
  const elapsedLabel = formatElapsed(elapsedMs)
  const slow = elapsedMs > 10 * 60_000

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
          <span key={phase} className="cm-fade-swap">
            🎨 {phase}…
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-violet-100/90">
            {elapsedLabel} elapsed · est. ~2 min
          </span>
        </span>
      </div>
      {slow && (
        <span className="text-[10px] text-amber-700">
          ⚠ Longer than usual — the Canva runner may be down. Safe to leave
          this open; the page will catch up when it lands.
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
//   in_canva        → "Drawing carousel…"
//   visuals_ready   → "🎨 Open in Canva ↗" + (caller will add Approve)
//   approved/etc    → "Re-compose" (allows regenerate)
//   pending/review  → "🎨 Compose in Canva" (primary action)
function ComposeInCanvaButton({
  status,
  renderResult,
  composing,
  queuedAt,
  onCompose,
}: {
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
    return <ComposeWaitingChip status={status} queuedAt={queuedAt} />
  }

  if (renderResult?.canva_edit_url) {
    return (
      <div className="flex flex-wrap gap-2">
        <a
          href={renderResult.canva_edit_url}
          target="_blank"
          rel="noopener noreferrer"
          className="cm-btn text-sm font-semibold"
          style={{
            background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)',
            color: 'white',
          }}
        >
          🎨 Open in Canva ↗
        </a>
        <button
          type="button"
          onClick={onCompose}
          disabled={composing}
          className="cm-btn cm-btn-ghost text-sm"
          title="Discard the current visuals and recompose from scratch"
        >
          {composing ? 'Re-composing…' : 'Re-compose'}
        </button>
      </div>
    )
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
