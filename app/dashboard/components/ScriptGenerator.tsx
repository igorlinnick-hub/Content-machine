'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { CriticScore, ScriptVariant, ComplianceResult } from '@/types'
import { ScriptCard } from './ScriptCard'
import { SparkleSpinner } from '@/app/components/ui/icons'
import { AdFormatPicker } from '@/app/components/AdFormatPicker'

import { type StructuredPlanWeek } from '@/lib/content-plan/store'

interface ScriptGeneratorProps {
  clinicId: string
  isAdmin?: boolean
  planWeeks?: StructuredPlanWeek[]
  currentWeekIndex?: number
  // Back-compat fallback when planWeeks isn't provided.
  currentWeek?: StructuredPlanWeek | null
}

interface GenerateResult {
  variants: ScriptVariant[]
  scores: CriticScore[]
  compliance: Array<{ variant_id: string; result: ComplianceResult | null }>
  rewritten: boolean
  saved: Array<{ id: string; variant_id: string }>
}

// ── Script-specific progress ──────────────────────────────────────────────────

type ScriptStage = 'writer' | 'critic' | 'compliance' | 'save'

const SCRIPT_STEPS: { id: ScriptStage; label: string; description: string }[] = [
  { id: 'writer',     label: 'Writer drafts 3 variants',  description: 'Matching your pillars and templates' },
  { id: 'critic',     label: 'Critic reviews',            description: 'Kills weak hooks and vague claims' },
  { id: 'compliance', label: 'Compliance check',          description: 'FDA / FTC ruleset gate' },
  { id: 'save',       label: 'Saving to library',         description: 'Stored and ready to pick' },
]

const STAGE_TO_BUCKET: Record<string, ScriptStage> = {
  start:            'writer',
  'writer:done':    'critic',
  'critic:done':    'compliance',
  'captioner:done': 'compliance',
  'compliance:done': 'save',
}

const ORDER: ScriptStage[] = SCRIPT_STEPS.map((s) => s.id)

interface ScriptProgressState {
  active: ScriptStage | null
  completed: ScriptStage[]
  elapsedMs: number
  error: string | null
}

function emptyProgress(): ScriptProgressState {
  return { active: null, completed: [], elapsedMs: 0, error: null }
}

function applyStage(state: ScriptProgressState, name: string, elapsed: number): ScriptProgressState {
  const bucket = STAGE_TO_BUCKET[name]
  if (!bucket) return { ...state, elapsedMs: elapsed }
  const idx = ORDER.indexOf(bucket)
  return { active: bucket, completed: ORDER.slice(0, idx), elapsedMs: elapsed, error: null }
}

function markDone(state: ScriptProgressState): ScriptProgressState {
  return { ...state, active: null, completed: ORDER }
}

function ScriptProgress({ state }: { state: ScriptProgressState }) {
  const status = (id: ScriptStage) => {
    if (state.completed.includes(id)) return 'done'
    if (state.active === id) return 'active'
    return 'pending'
  }
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-sky-200 bg-sky-50/40 p-5">
      <div className="flex items-baseline justify-between">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">
          <SparkleSpinner size={14} /> Generating scripts
        </p>
        <span className="font-mono text-[11px] text-neutral-500">
          {(state.elapsedMs / 1000).toFixed(1)}s
        </span>
      </div>
      <ol className="flex flex-col gap-2.5">
        {SCRIPT_STEPS.map((step) => {
          const s = status(step.id)
          return (
            <li key={step.id} className="flex items-start gap-3">
              <span
                className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ring-1 ${
                  s === 'done'
                    ? 'bg-emerald-500 text-white ring-emerald-500'
                    : s === 'active'
                      ? 'bg-sky-500 text-white ring-sky-500 cm-pulse'
                      : 'bg-white text-neutral-400 ring-neutral-300'
                }`}
              >
                {s === 'done' ? '✓' : ''}
              </span>
              <div className="flex flex-col">
                <span
                  className={`text-sm font-medium ${
                    s === 'done'
                      ? 'text-emerald-700'
                      : s === 'active'
                        ? 'text-sky-700'
                        : 'text-neutral-500'
                  }`}
                >
                  {step.label}
                </span>
                <span className="text-xs text-neutral-500">{step.description}</span>
              </div>
            </li>
          )
        })}
      </ol>
      {state.error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {state.error}
        </p>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

const STORE_KEY = (id: string) => `cm-scripts-${id}`

function saveScriptDraft(clinicId: string, result: GenerateResult) {
  try {
    localStorage.setItem(STORE_KEY(clinicId), JSON.stringify(result))
  } catch { /* storage full or SSR */ }
}

function loadScriptDraft(clinicId: string): GenerateResult | null {
  try {
    const raw = localStorage.getItem(STORE_KEY(clinicId))
    return raw ? (JSON.parse(raw) as GenerateResult) : null
  } catch { return null }
}

export function ScriptGenerator({
  clinicId,
  isAdmin = false,
  planWeeks = [],
  currentWeekIndex = 0,
  currentWeek: currentWeekProp = null,
}: ScriptGeneratorProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<GenerateResult | null>(null)
  // Which of the (up to 3) variants the reader is flipping through. Reset to
  // the first whenever a fresh batch lands so "Generate 3 more" starts at V1.
  const [activeVariant, setActiveVariant] = useState(0)
  // Once scripts exist the big generate form collapses into a slim black
  // "Generate 3 more" bar so the ready scripts own the view. `formOpen`
  // re-expands it (to change week / topic).
  const [formOpen, setFormOpen] = useState(false)
  const [topic, setTopic] = useState('')
  const [note, setNote] = useState('')
  // plannedPost: non-null = 90% planned path, null = 10% ad-hoc
  const [plannedPost, setPlannedPost] = useState<{
    id: string; topic: string; keyword: string | null
    week_number: number; pillar: string
  } | null>(null)
  const [progress, setProgress] = useState<ScriptProgressState>(emptyProgress())
  // The topic field and the starting note are folded away by default. In the
  // planned path the topic input isn't even sent (planTopicId carries it), and
  // the note arrives pre-filled from the week — so on the common run the
  // doctor reads one topic and taps generate instead of scanning five boxes.
  const [detailsOpen, setDetailsOpen] = useState(false)
  // null = organic script (the default). A name switches the run to a
  // paid ad spot; see lib/scripts/ad-formats.ts.
  const [adFormat, setAdFormat] = useState<string | null>(null)

  // New batch of variants → jump back to the first card.
  useEffect(() => {
    setActiveVariant(0)
  }, [result])

  // ── Week browsing + one-topic-at-a-time picker (mirrors the posts form) ──
  const [weekIdx, setWeekIdx] = useState(
    Math.min(Math.max(currentWeekIndex, 0), Math.max(planWeeks.length - 1, 0))
  )
  const currentWeek: StructuredPlanWeek | null = planWeeks[weekIdx] ?? currentWeekProp
  const [weekPosts, setWeekPosts] = useState<StructuredPlanWeek['posts']>(
    (currentWeek?.posts ?? []).filter((p) => p.status === 'pending')
  )
  const [rerollingTopicId, setRerollingTopicId] = useState<string | null>(null)
  const [addingTopic, setAddingTopic] = useState(false)
  const plannedIdx = weekPosts.findIndex((p) => p.id === plannedPost?.id)

  // Re-sync the topic queue whenever the marketer flips to another week.
  useEffect(() => {
    setWeekPosts((planWeeks[weekIdx]?.posts ?? []).filter((p) => p.status === 'pending'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekIdx])

  function selectPlanTopic(post: StructuredPlanWeek['posts'][number]) {
    if (!currentWeek) return
    setPlannedPost({
      id: post.id,
      topic: post.topic,
      keyword: post.keyword,
      week_number: currentWeek.week_number,
      pillar: currentWeek.pillar,
    })
    setTopic(post.topic)
    // Auto-fill the starting note with the week's angle — orientation, editable.
    setNote(currentWeek.description ?? '')
  }

  function cyclePlanTopic(dir: 1 | -1) {
    if (!weekPosts.length) return
    const base = plannedIdx < 0 ? 0 : plannedIdx
    const nextIdx = (base + dir + weekPosts.length) % weekPosts.length
    selectPlanTopic(weekPosts[nextIdx])
  }

  // Auto-load the next ready topic so the form is never empty.
  useEffect(() => {
    if (!weekPosts.length) return
    if (!plannedPost || plannedIdx < 0) selectPlanTopic(weekPosts[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekPosts, weekIdx])

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

  // Restore last batch on mount — persists until replaced by a new generation
  useEffect(() => {
    const saved = loadScriptDraft(clinicId)
    if (saved) setResult(saved)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId])

  // Live elapsed timer while generating
  useEffect(() => {
    if (!loading) return
    const start = Date.now()
    const id = setInterval(() => {
      setProgress((s) => ({ ...s, elapsedMs: Date.now() - start }))
    }, 250)
    return () => clearInterval(id)
  }, [loading])

  async function onGenerate() {
    setLoading(true)
    setError(null)
    setResult(null)
    setFormOpen(false) // collapse back to the black bar once this batch lands
    try { localStorage.removeItem(STORE_KEY(clinicId)) } catch { /* noop */ }
    setProgress(emptyProgress())

    try {
      const res = await fetch('/api/agents/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clinicId,
          // Planned (90%): planTopicId gives the Writer pillar/theme/keyword;
          // the starting note rides along as an extra angle hint.
          // Ad-hoc (10%): topic + note become the free-text hint.
          ...(plannedPost
            ? { planTopicId: plannedPost.id, topicHint: note.trim() || undefined }
            : { topicHint: [topic.trim(), note.trim()].filter(Boolean).join(' — ') || undefined }),
          ...(adFormat ? { adFormat } : {}),
        }),
      })

      if (!res.ok || !res.body) {
        let errMsg = `HTTP ${res.status}`
        try {
          const data = await res.json()
          if (data?.error) errMsg = data.error
        } catch { /* ignore */ }
        throw new Error(errMsg)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let finalResult: GenerateResult | null = null
      let streamError: string | null = null

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

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
          try { payload = JSON.parse(dataLine) } catch { continue }

          if (evName === 'stage') {
            const p = payload as { name?: string; elapsed_ms?: number }
            if (typeof p?.name === 'string') {
              setProgress((s) => applyStage(s, p.name as string, p.elapsed_ms ?? s.elapsedMs))
            }
          } else if (evName === 'done') {
            finalResult = payload as GenerateResult
            setProgress((s) => markDone(s))
          } else if (evName === 'error') {
            streamError = (payload as { error?: string })?.error ?? 'failed'
          }
        }
      }

      if (streamError) throw new Error(streamError)
      if (!finalResult) throw new Error('Stream ended without result')

      setResult(finalResult)
      saveScriptDraft(clinicId, finalResult)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown error')
    } finally {
      setLoading(false)
    }
  }

  // Show the full form on first load, while generating, or when the marketer
  // explicitly reopens it; otherwise (scripts ready) show the black bar.
  const showFullForm = loading || !result || formOpen

  return (
    <div className="flex flex-col gap-5">
      {!showFullForm ? (
        // ── Collapsed: slim black "Generate 3 more" bar ──────────────────
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-white shadow-sm">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400">
              Scripts ready
            </p>
            <p className="truncate text-sm font-medium text-white">
              {plannedPost?.topic || topic || currentWeek?.theme || 'Your topic'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="rounded-lg border border-white/25 px-3 py-2 text-[13px] font-medium text-neutral-200 transition hover:bg-white/10"
            >
              Change topic
            </button>
            <button
              type="button"
              onClick={onGenerate}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-[13px] font-semibold text-neutral-900 transition hover:bg-neutral-200 disabled:opacity-50"
            >
              {loading ? <SparkleSpinner size={14} /> : '↻'} Generate 3 more
            </button>
          </div>
        </div>
      ) : (
      // Phone: thinner card padding — three nested frames (section > card >
      // week strip) ate ~56px of a 390px screen. Original ≥sm.
      <div className="cm-card flex flex-col gap-4 p-3.5 sm:gap-4 sm:p-5">
        {/* Current week — one pre-filled topic at a time, browse the plan */}
        {currentWeek && weekPosts.length > 0 && (() => {
          // Whole strip (frame + arrows + topic + reroll + Next topic) uses
          // the sky accent — one consistent blue, no pillar colour.
          const color = '#0EA5E9'
          return (
            <div
              className="flex flex-col gap-3 rounded-xl border p-2.5 sm:gap-2 sm:p-3"
              style={{ background: `${color}08`, borderColor: `${color}25` }}
            >
              {/* Wraps on phones — the theme is long enough to shove the
                  week switcher off the row otherwise. Unchanged ≥sm. */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:flex-nowrap sm:gap-2">
                {/* Subtle week switcher — browse the whole plan */}
                <button
                  type="button"
                  onClick={() => setWeekIdx((i) => Math.max(0, i - 1))}
                  disabled={weekIdx === 0}
                  title="Previous week"
                  className="px-2 py-1 text-[14px] leading-none text-neutral-300 transition hover:text-neutral-600 disabled:opacity-25 sm:px-1 sm:py-0"
                >
                  ‹
                </button>
                <span className="rounded-full border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">
                  Week {currentWeek.week_number}
                </span>
                <button
                  type="button"
                  onClick={() => setWeekIdx((i) => Math.min(planWeeks.length - 1, i + 1))}
                  disabled={weekIdx >= planWeeks.length - 1}
                  title="Next week"
                  className="px-2 py-1 text-[14px] leading-none text-neutral-300 transition hover:text-neutral-600 disabled:opacity-25 sm:px-1 sm:py-0"
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
                <span className="min-w-0 truncate text-[11px] font-medium text-neutral-500">
                  {currentWeek.theme}
                </span>
              </div>
              {/* Phone: topic gets its own full-width line (order-1) and the
                  three controls sit on a second row with thumb-sized targets.
                  `sm:order-none` + `sm:basis-auto` put it back to one row,
                  in DOM order, on desktop — identical to before. */}
              <div className="flex flex-wrap items-center gap-2.5 sm:flex-nowrap sm:gap-2">
                <button
                  type="button"
                  disabled={loading || rerollingTopicId !== null || weekPosts.length < 2}
                  onClick={() => cyclePlanTopic(-1)}
                  title="Previous topic"
                  className="order-2 shrink-0 px-2.5 py-1.5 text-[15px] leading-none transition hover:opacity-100 disabled:opacity-20 sm:order-none sm:px-1 sm:py-0"
                  style={{ color }}
                >
                  ‹
                </button>
                {/* The topic is the one thing being decided here, so it gets
                    real size instead of competing with four other lines. */}
                <div className="order-1 min-w-0 basis-full sm:order-none sm:basis-auto sm:flex-1">
                  <p
                    className="text-[16px] font-semibold leading-snug sm:text-[15px]"
                    style={{ color: 'var(--hwc-ocean-dark, #0d2f42)' }}
                  >
                    {rerollingTopicId && plannedPost?.id === rerollingTopicId
                      ? 'Generating new topic…'
                      : plannedPost?.topic ?? weekPosts[0]?.topic}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={loading || rerollingTopicId !== null || !plannedPost}
                  onClick={() => plannedPost && rerollPlanTopic(plannedPost.id)}
                  title="Fresh take on this topic (same week + theme)"
                  className="order-3 shrink-0 px-2.5 py-1.5 text-[13px] opacity-50 transition hover:opacity-100 disabled:opacity-30 sm:order-none sm:px-1.5 sm:py-1"
                  style={{ color }}
                >
                  ↻
                </button>
                <button
                  type="button"
                  disabled={loading || rerollingTopicId !== null || addingTopic}
                  onClick={() => {
                    if (plannedIdx >= weekPosts.length - 1) addPlanTopic()
                    else cyclePlanTopic(1)
                  }}
                  title="Move to the next ready topic (generates a fresh one at the end)"
                  className="order-4 ml-auto shrink-0 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition hover:opacity-80 disabled:opacity-50 sm:order-none sm:ml-0 sm:py-1"
                  style={{ color, borderColor: `${color}55`, background: `${color}14` }}
                >
                  {addingTopic ? 'Generating…' : 'Next topic ›'}
                </button>
              </div>
            </div>
          )
        })()}

        {/* Topic field + starting note live behind one disclosure. Closed,
            they're a single quiet line; open, they behave exactly as before. */}
        {!detailsOpen ? (
          <button
            type="button"
            onClick={() => setDetailsOpen(true)}
            disabled={loading}
            className="flex items-center gap-2 self-start text-[12px] font-medium text-neutral-400 transition hover:text-neutral-700 disabled:opacity-50"
          >
            <span className="text-[13px] leading-none">+</span>
            {plannedPost ? 'Adjust topic or add a note' : 'Topic and note'}
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            <input
              type="text"
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value)
                // Typing a custom topic switches to ad-hoc mode
                if (plannedPost && e.target.value !== plannedPost.topic) setPlannedPost(null)
              }}
              onKeyDown={(e) => e.key === 'Enter' && !loading && onGenerate()}
              placeholder="Topic — e.g. ketamine for treatment-resistant depression"
              // 16px on phones so iOS doesn't zoom the page on focus; 14px ≥sm as before
              className="cm-input text-base sm:text-sm"
              disabled={loading}
            />
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional starting note — paste any rough thoughts, a key fact, the angle you want. Leave blank to let the team pick."
              rows={3}
              className="cm-input resize-none text-base sm:text-sm"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setDetailsOpen(false)}
              className="self-start text-[12px] font-medium text-neutral-400 transition hover:text-neutral-700"
            >
              Hide
            </button>
          </div>
        )}

        {/* Ad mode — off by default; picking a shape here replaces the whole
            organic script pipeline with the paid-spot one. */}
        <AdFormatPicker value={adFormat} onChange={setAdFormat} disabled={loading} />

        {/* Phone: stacked full-width actions (primary on top) instead of two
            buttons fighting for one cramped row. Row layout returns ≥sm. */}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          {/* Escape hatch: reopened the form but changed your mind */}
          {result && !loading && (
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="cm-btn cm-btn-ghost w-full text-sm sm:w-auto"
            >
              View scripts
            </button>
          )}
          <button
            type="button"
            onClick={onGenerate}
            disabled={loading}
            className="cm-btn cm-btn-primary w-full py-3 text-base sm:w-auto sm:px-7"
          >
            {loading ? <><SparkleSpinner size={16} /> Generating…</> : adFormat ? 'Generate 3 ad spots' : 'Generate 3 variants'}
          </button>
        </div>
      </div>
      )}

      {loading && <ScriptProgress state={progress} />}

      {!loading && result?.rewritten && (
        <p className="text-xs text-neutral-500">
          Rewritten once after critic feedback.
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {!loading && result && result.variants.length > 0 && (() => {
        // One script at a time — the reader flips ‹ / › through the batch and
        // can always go back. "Generate 3 more" lives in the black bar above,
        // so the pager just flips. The whole unit sits in a coloured frame so
        // the READY scripts clearly stand apart from everything else.
        const total = result.variants.length
        const idx = Math.min(Math.max(activeVariant, 0), total - 1)
        const v = result.variants[idx]
        const score = result.scores.find((s) => s.variant_id === v.id)
        const savedRow = result.saved.find((s) => s.variant_id === v.id)
        const siblingIds = result.saved
          .filter((s) => s.variant_id !== v.id)
          .map((s) => s.id)
        const compliance = result.compliance?.find((c) => c.variant_id === v.id)?.result ?? null
        const atLast = idx >= total - 1
        return (
          <div className="flex flex-col gap-3 rounded-2xl border-2 border-emerald-300 bg-emerald-50/50 p-2.5 sm:p-3">
            {/* Pager: read one, flip to the next, come back anytime */}
            <div className="flex items-center justify-between gap-2 px-1">
              <button
                type="button"
                onClick={() => setActiveVariant(idx - 1)}
                disabled={idx === 0}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-emerald-800 transition hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent"
              >
                ‹ Prev
              </button>
              <span className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Ready · Script {idx + 1} of {total}
              </span>
              <button
                type="button"
                onClick={() => setActiveVariant(idx + 1)}
                disabled={atLast}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-emerald-800 transition hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent"
              >
                Next ›
              </button>
            </div>
            <ScriptCard
              key={v.id}
              variant={v}
              score={score}
              compliance={compliance}
              clinicId={clinicId}
              scriptId={savedRow?.id}
              siblingScriptIds={siblingIds}
              isAdmin={isAdmin}
            />
          </div>
        )
      })()}
    </div>
  )
}
