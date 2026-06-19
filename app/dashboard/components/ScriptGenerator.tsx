'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { CriticScore, ScriptVariant, ComplianceResult } from '@/types'
import { ScriptCard } from './ScriptCard'

interface ScriptGeneratorProps {
  clinicId: string
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
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">
          Generating scripts
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

export function ScriptGenerator({ clinicId }: ScriptGeneratorProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [topic, setTopic] = useState('')
  const [progress, setProgress] = useState<ScriptProgressState>(emptyProgress())

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
    try { localStorage.removeItem(STORE_KEY(clinicId)) } catch { /* noop */ }
    setProgress(emptyProgress())

    try {
      const res = await fetch('/api/agents/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clinicId, topicHint: topic.trim() || undefined }),
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

  return (
    <div className="flex flex-col gap-5">
      <div className="cm-card flex flex-col gap-4 p-5">
        <div>
          <p className="text-base font-semibold text-neutral-900">
            Ready to generate 3 fresh variants
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
              Topic <span className="text-neutral-400">(optional)</span>
            </span>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && onGenerate()}
              placeholder="e.g. PRP for chronic shoulder pain"
              className="cm-input text-sm"
              disabled={loading}
            />
          </label>
          <button
            type="button"
            onClick={onGenerate}
            disabled={loading}
            className="cm-btn cm-btn-primary text-base sm:px-7 sm:py-3"
          >
            {loading ? 'Generating…' : 'Generate 3 variants'}
          </button>
        </div>
      </div>

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

      {!loading && result && (
        <div className="grid gap-4 md:grid-cols-1">
          {result.variants.map((v) => {
            const score = result.scores.find((s) => s.variant_id === v.id)
            const savedRow = result.saved.find((s) => s.variant_id === v.id)
            const siblingIds = result.saved
              .filter((s) => s.variant_id !== v.id)
              .map((s) => s.id)
            const compliance = result.compliance?.find((c) => c.variant_id === v.id)?.result ?? null
            return (
              <ScriptCard
                key={v.id}
                variant={v}
                score={score}
                compliance={compliance}
                clinicId={clinicId}
                scriptId={savedRow?.id}
                siblingScriptIds={siblingIds}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
