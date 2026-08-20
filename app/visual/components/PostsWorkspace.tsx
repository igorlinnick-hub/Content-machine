/* eslint-disable @next/next/no-img-element */
'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PostListItem } from '@/lib/visual/store'
import type { RenderResult, SlideSetStatus } from '@/types'
import { isActivelyMoving, statusMeta } from '@/lib/posts/status-owners'
import { SlideEditor, type UISlide } from './SlideEditor'
import { FormatPicker } from '@/app/components/FormatPicker'
import { PhotoPicker } from './PhotoPicker'
import {
  GenerateProgress,
  applyStageEvent,
  emptyProgressState,
} from './GenerateProgress'
import { type StructuredPlanWeek } from '@/lib/content-plan/store'
import { ScheduleModal } from '@/app/components/ScheduleModal'
import { Sparkle, SparkleSpinner } from '@/app/components/ui/icons'
import { canvaEditUrl, stylesForNiche } from '@/lib/posts/style-templates'

interface Props {
  clinicId: string
  /** `clinics.niche` — gates which styles this clinic may pick. */
  clinicNiche: string | null
  posts: PostListItem[]
  // Full plan + which week is "now" — the strip lets the marketer flip
  // between weeks with subtle ‹ › arrows and generate from any of them.
  planWeeks?: StructuredPlanWeek[]
  currentWeekIndex?: number
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
  // Design edit URL written by the runner right after it copies the template,
  // so the marketer can peek at the design mid-compose (it fills in near the end).
  edit_url?: string | null
}

interface PostDetail {
  slide_set_id: string
  topic: string | null
  hook: string | null
  script: string | null
  // Per-post publish descriptions written by the captioner. long_caption is
  // the Instagram carousel description — the custom text for the post's
  // "notes"/caption; short_caption is the Reels/TikTok one.
  long_caption: string | null
  short_caption: string | null
  slides: UISlide[]
  previews: string[]
  created_at: string
  status: SlideSetStatus
  render_result: RenderResult | null
  compliance: ComplianceData | null
  compose_progress: ComposeProgress | null
  // Which master the runner copies — ids and names live in
  // lib/posts/style-templates.ts (1-5, Aesthetic = 5, Made-only).
  // Picked BEFORE composing; the picker hides once visuals exist.
  canva_style: number
  // Effective Drive folder used by the renderer for body/cta photos.
  // Null when neither slide_set nor category has one — PhotoPicker
  // disables the re-index button in that case.
  drive_folder_id: string | null
  // Per-slide-index override map. Populated by PhotoPicker.
  photo_overrides: Record<string, string | null>
}

export function PostsWorkspace({
  clinicId,
  clinicNiche,
  posts: initialPosts,
  planWeeks = [],
  currentWeekIndex = 0,
}: Props) {
  // Master styles this clinic may pick — Aesthetic is Made-only, so Dr.
  // Shawn's regenmed clinics never see it.
  const styleChoices = useMemo(() => stylesForNiche(clinicNiche), [clinicNiche])
  // Week the strip is showing — starts at "now", arrows move it.
  const [weekIdx, setWeekIdx] = useState(
    Math.min(Math.max(currentWeekIndex, 0), Math.max(planWeeks.length - 1, 0))
  )
  // Clamp the lookup so the strip can NEVER render a null week (which would
  // hide the arrows and strand the marketer): if the plan reloads shorter,
  // fall back to the last week instead of vanishing.
  const safeWeekIdx =
    planWeeks.length > 0
      ? Math.min(Math.max(weekIdx, 0), planWeeks.length - 1)
      : 0
  const currentWeek: StructuredPlanWeek | null = planWeeks[safeWeekIdx] ?? null
  const router = useRouter()
  const [posts, setPosts] = useState<PostListItem[]>(initialPosts)
  const [selectedId, setSelectedId] = useState<string | null>(
    initialPosts[0]?.slide_set_id ?? null
  )
  const [detail, setDetail] = useState<PostDetail | null>(null)
  const [drafts, setDrafts] = useState<UISlide[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  // id of the post currently being deleted from the list, or null.
  const [deleting, setDeleting] = useState<string | null>(null)
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
  const [composing, setComposing] = useState(false)
  const [composeError, setComposeError] = useState<string | null>(null)
  // Set when the marketer presses Compose so the deadline UX can
  // show "in queue ~2 min" → "longer than usual" without flooding
  // the runner with re-pings. Reset on detail change.
  const [queuedAt, setQueuedAt] = useState<number | null>(null)

  // Stepper state for a background generation, derived from the
  // compose_progress the pipeline persists stage-by-stage. Survives
  // page reloads — the poll below keeps it moving.
  const genProgressState = useMemo(() => {
    if (!detail || detail.status !== 'generating') return null
    const cp = detail.compose_progress as
      | { stage?: string; elapsed_ms?: number }
      | null
    let s = emptyProgressState()
    if (cp?.stage) {
      s = applyStageEvent(s, cp.stage, cp.elapsed_ms ?? 0)
    }
    if (!s.active) s = { ...s, active: 'writer' }
    return s
  }, [detail])

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
        // Generation just finished (or failed): the row now carries the
        // real script + slides — swap the whole detail in, not just the
        // status fields, so the editor fills without a manual reload.
        if (detail.status === 'generating' && data.status !== 'generating') {
          setDetail(data)
          setDrafts((data.slides ?? []).slice())
          setPosts((prev) =>
            prev.map((p) =>
              p.slide_set_id === data.slide_set_id
                ? {
                    ...p,
                    status: data.status,
                    topic: data.topic ?? p.topic,
                    hook: data.hook ?? p.hook,
                    script: data.script ?? p.script,
                    slide_count: data.slides?.length ?? p.slide_count,
                  }
                : p
            )
          )
          router.refresh()
          return
        }
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

  // Re-read the selected post whenever the tab comes back into focus.
  //
  // The poll above only runs while the row is "actively moving", so a card
  // that was loaded as `review` never learns it has since been composed —
  // which happens whenever the compose was started somewhere else: another
  // tab, the poller picking up a queued row, or a second person in the
  // back-office. Igor hit exactly this: the post was `visuals_ready` with a
  // Canva link in the database while his screen still offered "Compose in
  // Canva" (2026-08-19). Only status/render_result/compose_progress are
  // merged, never the slides, so unsaved edits in the editor survive.
  useEffect(() => {
    const id = detail?.slide_set_id
    if (!id) return
    let alive = true

    async function resync() {
      if (!alive || document.visibilityState !== 'visible') return
      try {
        const res = await fetch(`/api/posts/${id}`)
        if (!res.ok || !alive) return
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
        // best-effort — the next focus tries again
      }
    }

    window.addEventListener('focus', resync)
    document.addEventListener('visibilitychange', resync)
    return () => {
      alive = false
      window.removeEventListener('focus', resync)
      document.removeEventListener('visibilitychange', resync)
    }
  }, [detail?.slide_set_id])

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
  // Autonomy-first: the form always opens on a ready-to-generate plan
  // topic. `manualMode` is the escape hatch — the "Blank post" custom form.
  const [manualMode, setManualMode] = useState(false)
  // Format = HOW this post is written (educational / tips / warning signs / …).
  // On a plan topic it is persisted to the row so the choice survives a reload;
  // on an ad-hoc topic it rides along in the generate call only.
  const [formatChoice, setFormatChoice] = useState<string | null>(null)

  // Re-sync the chips whenever the marketer flips to another week.
  useEffect(() => {
    const pending = (planWeeks[safeWeekIdx]?.posts ?? []).filter((p) => p.status === 'pending')
    setWeekPosts(pending)
    // Empty week: drop the stale selection so the form isn't tied to the
    // previous week's number/pillar at generate time.
    if (!pending.length) {
      setPlannedPost(null)
      setTopic('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekIdx])

  // Index of the currently-loaded plan topic within this week's queue.
  const plannedIdx = weekPosts.findIndex((p) => p.id === plannedPost?.id)

  function selectPlanTopic(post: StructuredPlanWeek['posts'][number]) {
    if (!currentWeek) return
    setManualMode(false)
    setPlannedPost({
      id: post.id,
      topic: post.topic,
      keyword: post.keyword,
      week_number: currentWeek.week_number,
      pillar: currentWeek.pillar,
    })
    setTopic(post.topic)
    setFormatChoice(post.format ?? null)
    // Auto-fill the starting note with the week's angle so the marketer
    // has orientation instead of a blank box. Editable / clearable.
    setNote(currentWeek.description ?? '')
  }

  function cyclePlanTopic(dir: 1 | -1) {
    if (!weekPosts.length) return
    const base = plannedIdx < 0 ? 0 : plannedIdx
    const nextIdx = (base + dir + weekPosts.length) % weekPosts.length
    selectPlanTopic(weekPosts[nextIdx])
  }

  // Auto-load the next ready topic whenever the selection is empty or stale
  // (first mount, week switch, or right after the current one was generated),
  // so the marketer never faces an empty form — unless they chose Blank post.
  useEffect(() => {
    if (manualMode || !weekPosts.length) return
    if (!plannedPost || plannedIdx < 0) selectPlanTopic(weekPosts[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekPosts, weekIdx, manualMode])

  async function chooseFormat(format: string | null) {
    const prev = formatChoice
    setFormatChoice(format)
    if (!plannedPost) return // ad-hoc: nothing to persist, it rides on generate
    const topicId = plannedPost.id
    setWeekPosts((cur) => cur.map((p) => (p.id === topicId ? { ...p, format } : p)))
    const res = await fetch('/api/content-plan/set-format', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ topicId, format }),
    }).catch(() => null)
    if (!res || !res.ok) setFormatChoice(prev)
  }

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

    try {
      // Background mode: the server creates a visible 'generating' row,
      // responds instantly, and finishes the pipeline server-side even
      // if this tab closes. Progress lives in compose_progress; the
      // detail poll below renders it as a stepper.
      const res = await fetch('/api/posts/generate?bg=1', {
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
          format: formatChoice ?? undefined,
        }),
      })
      const data = (await res.json().catch(() => null)) as {
        slide_set_id?: string
        error?: string
        ok?: boolean
      } | null
      if (!res.ok || !data?.slide_set_id) {
        let errMsg = data?.error ?? `HTTP ${res.status}`
        if (
          res.status === 503 &&
          (data?.error === 'LLM_AGENTS_DISABLED' || data?.ok === false)
        ) {
          errMsg = 'LLM_AGENTS_DISABLED'
        }
        throw new Error(errMsg)
      }

      const newItem: PostListItem = {
        slide_set_id: data.slide_set_id,
        script_id: null,
        topic: plannedPost?.topic ?? topic.trim(),
        hook: null,
        script: null,
        slide_count: 0,
        status: 'generating',
        created_at: new Date().toISOString(),
        length_target: null,
        pair_id: null,
        category: null,
        render_result: null,
      }
      setPosts((prev) => [newItem, ...prev])
      // Selecting the row kicks the detail fetch + the isActivelyMoving
      // poll, which flips the card to its real status when the server
      // pipeline lands (~2-3 min).
      setSelectedId(data.slide_set_id)
      // The topic chip is claimed server-side right away — drop it.
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

  // Regenerate ONE slide's text via the writer (slide-fixer). The
  // endpoint reloads the slide set from the DB, rewrites the targeted
  // slide, and persists it — so we only swap that one slide in both
  // `drafts` and `detail.slides`, preserving any unsaved edits to the
  // other slides. Returns a structured result so SlideEditor can show
  // the warning / error inline (never silent).
  const DEFAULT_REGEN =
    'Rewrite this slide with fresh, sharper wording. Keep the same meaning, the same slide kind, and stay compliant — specific and punchy, no vague claims.'
  async function regenerateSlide(
    index: number,
    instruction: string
  ): Promise<{ ok: boolean; warning?: string | null; error?: string }> {
    if (!detail) return { ok: false, error: 'No post loaded' }
    try {
      const res = await fetch(`/api/posts/${detail.slide_set_id}/slide-refine`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          index,
          instruction: instruction.trim() || DEFAULT_REGEN,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.slide) {
        return { ok: false, error: data?.error ?? `HTTP ${res.status}` }
      }
      const newSlide = data.slide as UISlide
      setDrafts((prev) => {
        const arr = prev.slice()
        arr[index] = newSlide
        return arr
      })
      // Endpoint already persisted this slide → mirror it into detail so
      // the dirty check doesn't flag this slide as unsaved.
      setDetail((d) =>
        d
          ? { ...d, slides: d.slides.map((s, i) => (i === index ? newSlide : s)) }
          : d
      )
      return { ok: true, warning: (data.warning as string | null) ?? null }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Regenerate failed' }
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

  async function handleStyleChange(s: number) {
    if (!detail || detail.canva_style === s) return
    setDetail((d) => (d ? { ...d, canva_style: s } : d))
    await fetch(`/api/posts/${detail.slide_set_id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ canva_style: s }),
    }).catch(() => null)
  }

  // Delete straight from the Recent Posts list (✕ on each row).
  async function remove(slideSetId: string) {
    if (deleting) return
    if (!confirm('Delete this post permanently?')) return
    setDeleting(slideSetId)
    setError(null)
    try {
      const res = await fetch(`/api/posts/${slideSetId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? `HTTP ${res.status}`)
      }
      const remaining = posts.filter((p) => p.slide_set_id !== slideSetId)
      setPosts(remaining)
      if (selectedId === slideSetId) {
        setSelectedId(remaining[0]?.slide_set_id ?? null)
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to delete')
    } finally {
      setDeleting(null)
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
          {/* Current week — one pre-filled topic at a time (hidden in Blank mode).
              The week switcher (arrows + label + theme) stays visible even when
              the week has no ready topics left, so the marketer can always page
              on to another week instead of being stranded on an empty one. */}
          {!manualMode && currentWeek && (() => {
            // Whole strip (frame + arrows + topic + reroll + Next topic) uses
            // the sky accent, not the pillar colour — one consistent blue.
            const color = '#0EA5E9'
            const hasTopics = weekPosts.length > 0
            return (
              <div
                className="flex flex-col gap-2 rounded-xl border p-3"
                style={{ background: `${color}08`, borderColor: `${color}25` }}
              >
                <div className="flex items-center gap-2">
                  {/* Subtle week switcher — browse the whole plan. Wraps around
                      (the plan is cyclic) so the arrows NEVER dead-end: from
                      the first week ‹ jumps to the last, from the last › to the
                      first. Only disabled when there is a single week to show. */}
                  <button
                    type="button"
                    onClick={() =>
                      setWeekIdx((i) => (i - 1 + planWeeks.length) % planWeeks.length)
                    }
                    disabled={planWeeks.length <= 1}
                    title="Previous week"
                    className="px-1 text-[14px] leading-none text-neutral-400 transition hover:text-neutral-700 disabled:opacity-25"
                  >
                    ‹
                  </button>
                  <span className="flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">
                    Week {currentWeek.week_number}
                    {planWeeks.length > 1 && (
                      <span className="font-semibold text-neutral-400">
                        {safeWeekIdx + 1}/{planWeeks.length}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setWeekIdx((i) => (i + 1) % planWeeks.length)
                    }
                    disabled={planWeeks.length <= 1}
                    title="Next week"
                    className="px-1 text-[14px] leading-none text-neutral-400 transition hover:text-neutral-700 disabled:opacity-25"
                  >
                    ›
                  </button>
                  {weekIdx !== currentWeekIndex && (
                    <button
                      type="button"
                      onClick={() => setWeekIdx(currentWeekIndex)}
                      title="Back to the current week"
                      className="text-[10px] font-semibold uppercase tracking-wider text-sky-500 transition hover:text-sky-700"
                    >
                      now
                    </button>
                  )}
                  <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-neutral-700">{currentWeek.theme}</span>
                </div>
                {hasTopics ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={generating || rerollingTopicId !== null || weekPosts.length < 2}
                      onClick={() => cyclePlanTopic(-1)}
                      title="Previous topic"
                      className="shrink-0 px-1 text-[15px] leading-none transition hover:opacity-100 disabled:opacity-20"
                      style={{ color }}
                    >
                      ‹
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-semibold" style={{ color }}>
                        {rerollingTopicId && plannedPost?.id === rerollingTopicId
                          ? 'Generating new topic…'
                          : plannedPost?.topic ?? weekPosts[0]?.topic}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={generating || rerollingTopicId !== null || !plannedPost}
                      onClick={() => plannedPost && rerollPlanTopic(plannedPost.id)}
                      title="Fresh take on this topic (same week + theme)"
                      className="shrink-0 px-1.5 py-1 text-[13px] opacity-50 transition hover:opacity-100 disabled:opacity-30"
                      style={{ color }}
                    >
                      ↻
                    </button>
                    <button
                      type="button"
                      disabled={generating || rerollingTopicId !== null || addingTopic}
                      onClick={() => {
                        if (plannedIdx >= weekPosts.length - 1) addPlanTopic()
                        else cyclePlanTopic(1)
                      }}
                      title="Move to the next ready topic (generates a fresh one at the end)"
                      className="shrink-0 rounded-lg border px-3 py-1 text-[11px] font-semibold transition hover:opacity-80 disabled:opacity-50"
                      style={{ color, borderColor: `${color}55`, background: `${color}14` }}
                    >
                      {addingTopic ? 'Generating…' : 'Next topic ›'}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 text-[12.5px] font-medium text-neutral-400">
                      All topics used this week.
                    </p>
                    <button
                      type="button"
                      disabled={generating || addingTopic}
                      onClick={() => addPlanTopic()}
                      title="Generate a fresh topic for this week"
                      className="shrink-0 rounded-lg border px-3 py-1 text-[11px] font-semibold transition hover:opacity-80 disabled:opacity-50"
                      style={{ color, borderColor: `${color}55`, background: `${color}14` }}
                    >
                      {addingTopic ? 'Generating…' : 'New topic'}
                    </button>
                  </div>
                )}
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
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional starting note — paste any rough thoughts, a key fact, the angle you want. Leave blank to let the team pick."
            rows={3}
            className="cm-input resize-none text-sm"
            disabled={generating}
          />
          <div className="flex items-center justify-between gap-3">
            {/* HOW the post is written. The week's theme still decides WHAT
                it is about — this is the shape it takes. */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400">
                Format
              </span>
              <FormatPicker
                value={formatChoice}
                onChange={chooseFormat}
                disabled={generating}
                align="left"
              />
            </div>
            <button
              type="button"
              onClick={generate}
              disabled={generating || !topic.trim()}
              className="cm-btn cm-btn-primary text-sm"
            >
              {generating ? 'Generating…' : 'Generate'}
            </button>
          </div>
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

      <div className="grid min-h-[calc(100vh-280px)] grid-cols-1 gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Sidebar — always 260px wide; list hides on collapse, header stays */}
        <aside className={`cm-card flex flex-col overflow-hidden ${postsCollapsed ? 'h-fit' : 'max-h-[calc(100vh-280px)]'}`}>
          <header className="flex items-start justify-between border-b border-neutral-200 px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-500">
                Recent posts
              </p>
              <p className="text-xs text-neutral-500">{posts.length} total</p>
            </div>
            <button
              type="button"
              onClick={() => setPostsCollapsed((v) => !v)}
              title={postsCollapsed ? 'Show list' : 'Hide list'}
              className="rounded-lg border border-neutral-200 px-2 py-1 text-xs text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-700"
            >
              {postsCollapsed ? '▾' : '▴'}
            </button>
          </header>
          {!postsCollapsed && (
            posts.length === 0 ? (
              <p className="p-4 text-sm text-neutral-500">No posts yet.</p>
            ) : (
              <ul className="flex-1 overflow-y-auto">
                {posts.map((p) => {
                  const active = p.slide_set_id === selectedId
                  const isDeleting = deleting === p.slide_set_id
                  return (
                    <li
                      key={p.slide_set_id}
                      className={`group relative border-b border-neutral-200 transition ${
                        active ? 'bg-sky-50' : 'hover:bg-neutral-50'
                      } ${isDeleting ? 'opacity-50' : ''}`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedId(p.slide_set_id)}
                        className="w-full px-4 py-3 pr-16 text-left"
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
                      {/* PNG download — hover-only, left of delete */}
                      <a
                        href={`/api/visual/download?slideSetId=${p.slide_set_id}`}
                        title="Download PNG"
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-8 top-2.5 rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400 opacity-0 shadow-sm transition hover:border-sky-300 hover:text-sky-600 focus:opacity-100 group-hover:opacity-100"
                      >
                        PNG
                      </a>
                      <button
                        type="button"
                        onClick={() => remove(p.slide_set_id)}
                        disabled={deleting !== null}
                        title="Delete this post permanently"
                        className="absolute right-2 top-2.5 rounded-md px-1.5 py-0.5 text-sm leading-none text-neutral-300 opacity-0 transition hover:bg-red-50 hover:text-red-600 focus:opacity-100 group-hover:opacity-100 disabled:opacity-30"
                      >
                        {isDeleting ? '…' : '✕'}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )
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
          ) : detail.status === 'generating' ? (
            // Background generation in flight — stepper fed from the DB.
            // Closing the tab is safe; the poll refreshes this view and
            // swaps in the finished post automatically.
            <div className="cm-card flex flex-col gap-4 p-6">
              <h2 className="text-xl font-semibold text-neutral-900">
                {detail.topic ?? 'Untitled post'}
              </h2>
              {genProgressState && <GenerateProgress state={genProgressState} />}
              <p className="text-xs text-neutral-500">
                Generation runs on the server — you can leave this page or
                close the tab, the post will finish on its own (~2–3 min).
              </p>
            </div>
          ) : detail.status === 'gen_failed' ? (
            <div className="cm-card flex flex-col gap-3 p-6">
              <h2 className="text-xl font-semibold text-neutral-900">
                {detail.topic ?? 'Untitled post'}
              </h2>
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm font-semibold text-red-800">
                  Generation failed
                </p>
                <p className="mt-1 text-xs text-red-700">
                  {detail.compose_progress?.error ?? 'Unknown error.'}
                </p>
                <p className="mt-2 text-xs text-red-600">
                  The topic went back to the week picker — delete this card
                  (✕ in the list) and generate again.
                </p>
              </div>
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
                  {/* Compose progress chip — ONLY while a compose is actually
                      running. An idle queued row just shows the normal
                      Compose button below. */}
                  {(detail.status === 'ready_for_canva' || detail.status === 'in_canva') && (
                    <div className="flex flex-wrap items-center gap-2">
                      <ComposeWaitingChip
                        status={detail.status}
                        queuedAt={queuedAt}
                        progress={detail.compose_progress}
                      />
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
                    {/* Style is picked BEFORE composing — once visuals exist
                        the choice is baked in, so the picker disappears. Each
                        style shows its template cover so the marketer can see
                        which style is which; hover enlarges the preview. */}
                    {!detail.render_result?.canva_edit_url && (
                      <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/60 p-1">
                        {/* Driven by the master registry, so the picker can never
                            drift from what the runner actually copies. Aesthetic
                            is filtered out for non-Made clinics by stylesForNiche. */}
                        {styleChoices.map((t) => {
                          const active = (detail.canva_style ?? 1) === t.id
                          return (
                            <div key={t.id} className="group relative flex flex-col items-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => handleStyleChange(t.id)}
                                title={`${t.name} — ${t.description}`}
                                className="flex flex-col items-center gap-0.5"
                              >
                                <span
                                  className={`block overflow-hidden rounded-md border-2 transition-all ${
                                    active
                                      ? 'border-violet-600 ring-2 ring-violet-200'
                                      : 'border-transparent opacity-70 hover:opacity-100'
                                  }`}
                                >
                                  <img
                                    src={t.previewImage}
                                    alt={t.name}
                                    className="h-12 w-[38px] bg-slate-100 object-cover object-top"
                                  />
                                </span>
                                <span
                                  className={`text-[9px] font-semibold leading-none ${
                                    active ? 'text-violet-700' : 'text-slate-500'
                                  }`}
                                >
                                  {t.name}
                                </span>
                              </button>
                              {/* Hover-enlarge preview — clickable, opens the master
                                  design in Canva to edit. pb-2 (not mb-2) keeps a
                                  transparent hover bridge so the popup stays reachable. */}
                              <a
                                href={canvaEditUrl(t.canvaDesignId)}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={`Open the ${t.name} master in Canva to edit`}
                                className="absolute bottom-full left-1/2 z-30 hidden -translate-x-1/2 pb-2 group-hover:block"
                              >
                                <span className="block overflow-hidden rounded-xl border border-slate-300 bg-white p-2 shadow-2xl">
                                  <img
                                    src={t.previewImage}
                                    alt={`${t.name} full`}
                                    className="block w-[352px] max-w-[85vw] rounded-lg bg-slate-100"
                                  />
                                </span>
                                <span className="mt-1.5 flex items-center justify-center gap-1 text-xs font-semibold text-violet-600">
                                  Open in Canva to edit ↗
                                </span>
                              </a>
                            </div>
                          )
                        })}
                      </div>
                    )}
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
                          // Trust the server: inline mode returns 'in_canva'
                          // (live progress chip); queue mode returns
                          // 'ready_for_canva' (external runner). Guessing here
                          // made the chip flash and "stop" 4s later.
                          const serverStatus =
                            ((data as { status?: string }).status ?? 'in_canva') as SlideSetStatus
                          // mode 'queue' is the normal path: the local
                          // canva-runner picks the row up within ~2 min.
                          setDetail((d) =>
                            d
                              ? { ...d, status: serverStatus, compose_progress: null }
                              : d
                          )
                          setPosts((prev) =>
                            prev.map((p) =>
                              p.slide_set_id === detail.slide_set_id
                                ? { ...p, status: serverStatus }
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
                      className="cm-btn cm-btn-sky text-sm font-semibold"
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
                    onRegenerate={(instruction) => regenerateSlide(i, instruction)}
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
          initialCaption={
            // Prefer the captioner's custom per-post IG description; fall back
            // to topic+hook only if it hasn't been generated yet.
            detail.long_caption?.trim() ||
            (detail.hook ? `${detail.topic ?? ''}\n\n${detail.hook}` : (detail.topic ?? ''))
          }
          initialMediaUrl={detail.render_result?.outputs?.[0]?.url ?? ''}
          onSaved={(post) => {
            // Keep the modal open on failure so the Buffer errors stay visible
            if (post.status === 'failed') return
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
/** After this long with no stage progress, stop pretending it's in flight. */
const STALE_QUEUE_MS = 3 * 60 * 1000

const STAGE_LABELS: Record<string, string> = {
  load: 'Loading slides',
  photos: 'Generating slide photos',
  upload: 'Uploading photos to Canva',
  autofill: 'Filling the brand template',
  save: 'Saving result',
}

// The five stations of a compose, in the order the runner reports them
// (`load:start` → `photos:*` → `upload:*` → `autofill:start` → `save:done`,
// see the canva-compose-runner skill). Labels are short on purpose — this
// sits under a chip, not on a dashboard.
const COMPOSE_STEPS: Array<{ key: string; label: string }> = [
  { key: 'load', label: 'Slides' },
  { key: 'photos', label: 'Photos' },
  { key: 'upload', label: 'Upload' },
  { key: 'autofill', label: 'Canva' },
  { key: 'save', label: 'Save' },
]

/**
 * Which steps are finished and which one is running right now.
 * `doneUpTo` is the last COMPLETED index (-1 = none); `active` is the index
 * in flight (-1 = nothing started — the row is still queued).
 *
 * A `:done` suffix means that station finished, so it counts as complete and
 * the next one is what we're waiting on. Anything else (`:start`, bare) means
 * that station is the one running.
 */
function composeStepState(progress: ComposeProgress | null): {
  doneUpTo: number
  active: number
} {
  const stage = progress?.stage
  if (!stage || stage === 'error' || stage === 'blocked') {
    return { doneUpTo: -1, active: -1 }
  }
  const [key, phase] = stage.split(':')
  const idx = COMPOSE_STEPS.findIndex((s) => s.key === key)
  if (idx < 0) return { doneUpTo: -1, active: -1 }
  if (phase === 'done') {
    return { doneUpTo: idx, active: idx + 1 < COMPOSE_STEPS.length ? idx + 1 : -1 }
  }
  return { doneUpTo: idx - 1, active: idx }
}

/**
 * Compact five-dot progress rail under the compose chip (Igor 2026-08-12).
 * The chip alone says WHAT is happening; this says WHERE in the run it is,
 * which is the thing you actually want when a compose takes minutes.
 *
 * Honest by construction: a queued row shows every step pending with the
 * first one dashed — nothing is claimed to be running before the runner
 * picks the post up.
 */
function ComposeStepper({ progress }: { progress: ComposeProgress | null }) {
  const { doneUpTo, active } = composeStepState(progress)
  const started = active >= 0 || doneUpTo >= 0

  return (
    <div
      className="flex items-start px-1 pt-0.5"
      role="group"
      aria-label="Compose progress"
    >
      {COMPOSE_STEPS.map((step, i) => {
        const isDone = i <= doneUpTo
        const isActive = i === active
        const isNext = !started && i === 0

        return (
          <Fragment key={step.key}>
            {i > 0 && (
              <span
                aria-hidden
                className={`mt-[6px] h-[2px] flex-1 rounded-full transition-colors duration-500 ${
                  i <= doneUpTo || (isActive && doneUpTo >= i - 1)
                    ? 'bg-violet-400'
                    : 'bg-slate-200'
                }`}
              />
            )}
            <span
              className="flex w-12 shrink-0 flex-col items-center gap-1"
              aria-current={isActive ? 'step' : undefined}
            >
              <span
                aria-hidden
                className={`flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold leading-none transition-colors duration-300 ${
                  isDone
                    ? 'bg-violet-500 text-white'
                    : isActive
                      ? 'cm-pulse bg-sky-500 text-white'
                      : isNext
                        ? 'cm-dot-blink border border-dashed border-slate-400 bg-white'
                        : 'border border-slate-300 bg-white'
                }`}
              >
                {isDone ? '✓' : ''}
              </span>
              <span
                className={`text-[9px] uppercase leading-none tracking-wide ${
                  isActive
                    ? 'font-semibold text-slate-900'
                    : isDone
                      ? 'text-slate-500'
                      : 'text-slate-400'
                }`}
              >
                {step.label}
              </span>
            </span>
          </Fragment>
        )
      })}
    </div>
  )
}

function composeStageLabel(progress: ComposeProgress | null, status: SlideSetStatus): string {
  if (!progress?.stage || progress.stage === 'error') {
    // No "~2 min" promise on the queued state: carousels are built by the
    // in-session Claude+MCP runner, not by a deployed poller, so a queued row
    // waits for a human to start the runner. The old copy counted to 70+
    // minutes toward a robot that does not exist (Igor 2026-08-12).
    return status === 'in_canva' ? 'Composing in Canva' : 'Waiting for the Canva runner'
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

  // The runner is alive but can't work — e.g. Replicate credit ran out.
  // Show the reason instead of an eternal "Queued" countdown; the queue
  // resumes on its own once the blocker clears.
  if (progress?.stage === 'blocked') {
    return (
      <div className="flex max-w-md items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2">
        <span aria-hidden className="mt-0.5 text-sm">⏸</span>
        <span className="text-xs font-medium leading-snug text-amber-800">
          Composing is paused: {progress.error ?? 'external service unavailable'}
        </span>
      </div>
    )
  }

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
            <SparkleSpinner size={13} className="inline-block align-[-0.125em]" /> {label}…
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-violet-100/90">
            {inStage
              ? `${elapsedLabel} in this step · est. ~2 min total`
              : `${elapsedLabel} elapsed`}
          </span>
        </span>
      </div>
      <ComposeStepper progress={progress} />
      {/* A queued row with no stage progress is not "slow" — nothing is
          working on it until the runner is started. Say that instead of
          letting the counter climb (Igor 2026-08-12). */}
      {!inStage && elapsedMs > STALE_QUEUE_MS && (
        <span className="max-w-md text-[10px] font-medium leading-snug text-amber-700">
          Still queued — the carousel is built by the Canva runner in a Claude
          session, so nothing happens until that runner is started.
        </span>
      )}
      {progress?.edit_url && (
        <a
          href={progress.edit_url}
          target="_blank"
          rel="noreferrer"
          className="text-[10px] font-medium text-violet-600 underline decoration-dotted hover:text-violet-800"
        >
          Open in Canva ↗ (fills in as it builds)
        </a>
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
          className="cm-btn cm-btn-violet text-sm font-semibold"
        >
          {opening ? <><SparkleSpinner size={14} /> Opening…</> : <><Sparkle size={15} twin /> Open in Canva ↗</>}
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
        <Sparkle size={15} twin /> Compose in Canva
      </button>
    )
  }

  if (status === 'ready_for_canva' || status === 'in_canva') {
    // The live progress chip (with Stop) is rendered above the button
    // row by the parent — nothing needed in this slot. Queued rows are
    // picked up by the local canva-runner automatically.
    return null
  }

  if (renderResult?.canva_edit_url) {
    return <OpenInCanvaButton slideSetId={slideSetId} composing={composing} onCompose={onCompose} />
  }

  return (
    <button
      type="button"
      onClick={onCompose}
      disabled={composing}
      className="cm-btn cm-btn-violet text-sm font-semibold"
    >
      {composing ? <><SparkleSpinner size={14} /> Queuing…</> : <><Sparkle size={15} twin /> Compose in Canva</>}
    </button>
  )
}
