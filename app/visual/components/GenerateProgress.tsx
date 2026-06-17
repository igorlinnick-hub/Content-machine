'use client'

// Vertical stepper that mirrors the server-side stage names the
// /api/posts/generate stream emits. The route fires ~13 stages; here
// we collapse them into 6 user-visible buckets so the marketer sees
// a meaningful storyline ("Writer is drafting…") instead of cryptic
// internal names.

export type ProgressStage = 'writer' | 'critic' | 'caption' | 'compliance' | 'splitter' | 'save'

export interface ProgressStep {
  id: ProgressStage
  label: string
  description: string
}

export const PROGRESS_STEPS: ProgressStep[] = [
  { id: 'writer',     label: 'Writer drafts the script',  description: '3 variants → best one wins' },
  { id: 'critic',     label: 'Critic reviews',            description: 'Kills weak hooks + vague claims' },
  { id: 'caption',    label: 'Captioner',                 description: 'Long-form + short-form captions' },
  { id: 'compliance', label: 'Compliance check',          description: 'FDA / FTC ruleset gate' },
  { id: 'splitter',   label: 'Splitter builds slides',    description: 'PostPlan structured carousel' },
  { id: 'save',       label: 'Saving',                    description: 'Slide set + plan + status' },
]

// Maps server stage name → bucket. Stages not listed are ignored.
const STAGE_TO_BUCKET: Record<string, ProgressStage> = {
  'queued': 'writer',
  'start': 'writer',
  'writer:done': 'critic',
  'critic:done': 'caption',
  'captioner:done': 'compliance',
  'compliance:done': 'splitter',
  'splitter:postplan:start': 'splitter',
  'splitter:postplan:done': 'save',
  'postplan:persisted': 'save',
  'splitter:legacy:start': 'splitter',
}

// The bucket order is the canonical pipeline order. Used to mark
// everything before the currently-active bucket as done.
const ORDER: ProgressStage[] = PROGRESS_STEPS.map((s) => s.id)

export interface ProgressState {
  // Which bucket is currently in progress. null = not started.
  active: ProgressStage | null
  // Completed bucket IDs (in order). Includes the final 'save' when done.
  completed: ProgressStage[]
  // Server stage names received so far (raw — for debugging).
  rawStages: string[]
  elapsedMs: number
  error: string | null
}

export function emptyProgressState(): ProgressState {
  return { active: null, completed: [], rawStages: [], elapsedMs: 0, error: null }
}

export function applyStageEvent(
  state: ProgressState,
  stageName: string,
  elapsedMs: number
): ProgressState {
  const bucket = STAGE_TO_BUCKET[stageName]
  const rawStages = [...state.rawStages, stageName]
  if (!bucket) {
    return { ...state, rawStages, elapsedMs }
  }
  // Mark all buckets BEFORE this one as done; this bucket is now active.
  const idx = ORDER.indexOf(bucket)
  const completed = ORDER.slice(0, idx)
  return {
    active: bucket,
    completed,
    rawStages,
    elapsedMs,
    error: null,
  }
}

export function markDone(state: ProgressState, elapsedMs: number): ProgressState {
  return { ...state, active: null, completed: ORDER, elapsedMs }
}

export function GenerateProgress({ state }: { state: ProgressState }) {
  const status = (id: ProgressStage): 'done' | 'active' | 'pending' => {
    if (state.completed.includes(id)) return 'done'
    if (state.active === id) return 'active'
    return 'pending'
  }
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-sky-200 bg-sky-50/40 p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">
          Generating post
        </p>
        <span className="font-mono text-[11px] text-neutral-500">
          {(state.elapsedMs / 1000).toFixed(1)}s
        </span>
      </div>
      <ol className="flex flex-col gap-2.5">
        {PROGRESS_STEPS.map((step) => {
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
