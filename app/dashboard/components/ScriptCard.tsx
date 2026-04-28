'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CriticScore, ScriptVariant } from '@/types'

type FeedbackState = 'idle' | 'saving' | 'selected' | 'rejected' | 'error'

interface ScriptCardProps {
  variant: ScriptVariant
  score?: CriticScore
  clinicId?: string
  scriptId?: string
  siblingScriptIds?: string[]
}

export function ScriptCard({
  variant: initialVariant,
  score: initialScore,
  clinicId,
  scriptId: initialScriptId,
  siblingScriptIds,
}: ScriptCardProps) {
  const router = useRouter()
  const [variant, setVariant] = useState<ScriptVariant>(initialVariant)
  const [score, setScore] = useState<CriticScore | undefined>(initialScore)
  const [scriptId, setScriptId] = useState<string | undefined>(initialScriptId)
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState>('idle')
  const [feedbackError, setFeedbackError] = useState<string | null>(null)
  const [refineOpen, setRefineOpen] = useState(false)
  const [refineNote, setRefineNote] = useState('')
  const [refining, setRefining] = useState(false)
  const [refineError, setRefineError] = useState<string | null>(null)
  const [refineCount, setRefineCount] = useState(0)
  const [slidesLoading, setSlidesLoading] = useState(false)
  const [slidesError, setSlidesError] = useState<string | null>(null)
  const [slides, setSlides] = useState<{
    downloadUrl: string
    previews: string[]
    count: number
  } | null>(null)
  const total = score?.total_score
  const strong = typeof total === 'number' && total >= 7

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(variant.script)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // older browsers / insecure contexts — user can still select text
    }
  }

  async function sendFeedback(action: 'selected' | 'rejected') {
    if (!clinicId || !scriptId) return
    setFeedback('saving')
    setFeedbackError(null)
    try {
      const res = await fetch('/api/scripts/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clinicId,
          scriptId,
          action,
          siblingIds: action === 'selected' ? siblingScriptIds ?? [] : [],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      setFeedback(action)
      router.refresh()
    } catch (err) {
      setFeedback('error')
      setFeedbackError(err instanceof Error ? err.message : 'unknown error')
    }
  }

  async function refine() {
    if (!clinicId || !scriptId) return
    setRefining(true)
    setRefineError(null)
    try {
      const res = await fetch('/api/agents/refine', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clinicId,
          scriptId,
          note: refineNote.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      if (data.variant) {
        setVariant(data.variant as ScriptVariant)
      }
      if (data.score) {
        setScore(data.score as CriticScore)
      } else {
        setScore(undefined)
      }
      if (data.scriptId) {
        setScriptId(data.scriptId as string)
      }
      // Reset feedback state for the new attempt.
      setFeedback('idle')
      setFeedbackError(null)
      setRefineNote('')
      setRefineOpen(false)
      setRefineCount((c) => c + 1)
    } catch (err) {
      setRefineError(err instanceof Error ? err.message : 'unknown error')
    } finally {
      setRefining(false)
    }
  }

  async function makeSlides() {
    if (!scriptId) return
    setSlidesLoading(true)
    setSlidesError(null)
    try {
      const res = await fetch('/api/visual/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scriptId, returnPreview: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      setSlides({
        downloadUrl: data.download_url as string,
        previews: (data.previews as string[]) ?? [],
        count: (data.slide_count as number) ?? 0,
      })
    } catch (err) {
      setSlidesError(err instanceof Error ? err.message : 'unknown error')
    } finally {
      setSlidesLoading(false)
    }
  }

  const locked = feedback === 'selected' || feedback === 'rejected'
  const canFeedback = Boolean(clinicId && scriptId)
  const canRefine = canFeedback && !locked && !refining
  const canSlides = Boolean(scriptId) && !slidesLoading

  return (
    <article className="cm-card flex flex-col gap-4 p-5 sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-neutral-500">
            <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-neutral-700">
              {variant.id}
            </span>
            <span>·</span>
            <span>{variant.word_count} words</span>
            <span>·</span>
            <span>~{variant.estimated_seconds}s</span>
          </div>
          <h3 className="mt-2 text-lg font-semibold leading-snug text-neutral-900">
            {variant.topic}
          </h3>
        </div>
        {typeof total === 'number' && (
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
              strong
                ? 'bg-green-100 text-green-800'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {total.toFixed(1)} / 10
          </span>
        )}
      </header>

      <p className="rounded-lg border border-sky-100 bg-sky-50 px-4 py-3 text-sm italic text-sky-900">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider not-italic text-sky-500">
          Hook
        </span>
        {variant.hook}
      </p>

      <pre className="whitespace-pre-wrap rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-4 font-sans text-[15px] leading-relaxed text-neutral-900">
        {variant.script}
      </pre>

      {score && (
        <details className="text-xs text-neutral-600">
          <summary className="cursor-pointer font-medium text-neutral-700 hover:text-neutral-900">
            Critic detail
          </summary>
          <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-5">
            <li>tone: {score.criteria.tone_match}</li>
            <li>no_promises: {score.criteria.no_promises}</li>
            <li>hook: {score.criteria.hook_quality}</li>
            <li>length: {score.criteria.length_ok}</li>
            <li>science: {score.criteria.science_present}</li>
          </ul>
          <p className="mt-2 text-neutral-700">{score.feedback}</p>
        </details>
      )}

      <footer className="flex flex-col gap-3 border-t border-neutral-100 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {canFeedback && (
              <>
                <button
                  type="button"
                  onClick={() => sendFeedback('selected')}
                  disabled={locked || feedback === 'saving' || refining}
                  className={`cm-btn text-sm ${
                    feedback === 'selected'
                      ? 'cm-btn-success'
                      : 'cm-btn-success-outline'
                  }`}
                >
                  {feedback === 'selected' ? '✓ Picked' : 'Pick'}
                </button>
                <button
                  type="button"
                  onClick={() => setRefineOpen((v) => !v)}
                  disabled={!canRefine}
                  className={`cm-btn text-sm ${
                    refineOpen
                      ? 'cm-btn-primary'
                      : 'cm-btn-ghost border border-sky-200 text-sky-700 hover:bg-sky-50'
                  }`}
                >
                  {refining ? 'Refining…' : refineOpen ? 'Cancel' : 'Refine'}
                </button>
                <button
                  type="button"
                  onClick={() => sendFeedback('rejected')}
                  disabled={locked || feedback === 'saving' || refining}
                  className={`cm-btn text-sm ${
                    feedback === 'rejected'
                      ? 'cm-btn-danger'
                      : 'cm-btn-danger-outline'
                  }`}
                >
                  {feedback === 'rejected' ? '✕ Passed' : 'Pass'}
                </button>
              </>
            )}
            {feedbackError && (
              <span className="text-xs text-red-600">{feedbackError}</span>
            )}
            {refineCount > 0 && (
              <span className="text-[11px] uppercase tracking-wider text-neutral-400">
                refined ×{refineCount}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {scriptId && (
              <button
                type="button"
                onClick={makeSlides}
                disabled={!canSlides}
                className="cm-btn cm-btn-ghost text-sm border border-sky-200 text-sky-700 hover:bg-sky-50"
                title="Render this script as a PNG carousel"
              >
                {slidesLoading ? 'Making slides…' : slides ? '🎴 Re-render' : '🎴 Make slides'}
              </button>
            )}
            <button
              type="button"
              onClick={onCopy}
              className="cm-btn cm-btn-ghost text-sm"
            >
              {copied ? 'Copied' : 'Copy script'}
            </button>
          </div>
        </div>

        {slidesError && (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {slidesError}
          </p>
        )}

        {slides && slides.previews.length > 0 && (
          <div className="flex flex-col gap-2 rounded-lg border border-sky-200 bg-sky-50/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wider text-sky-700">
                {slides.count} slide{slides.count === 1 ? '' : 's'} ready
              </p>
              <a
                href={slides.downloadUrl}
                download
                className="cm-btn cm-btn-primary text-xs"
              >
                Download .zip
              </a>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <div className="-mx-1 flex gap-1.5 overflow-x-auto pb-1">
              {slides.previews.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt={`Slide ${i + 1}`}
                  className="h-24 w-24 shrink-0 rounded border border-neutral-200 bg-white object-contain"
                />
              ))}
            </div>
          </div>
        )}

        {refineOpen && (
          <div className="flex flex-col gap-2 rounded-lg border border-sky-200 bg-sky-50/60 p-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium uppercase tracking-wider text-sky-700">
                What to change <span className="text-sky-500">(optional)</span>
              </span>
              <input
                type="text"
                value={refineNote}
                onChange={(e) => setRefineNote(e.target.value)}
                placeholder="Hook is too generic / make it more concrete / shorten"
                className="cm-input text-sm"
                disabled={refining}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={refine}
                disabled={refining}
                className="cm-btn cm-btn-primary text-xs"
              >
                {refining ? 'Refining…' : 'Try again'}
              </button>
              <span className="self-center text-[11px] text-neutral-500">
                Same topic, kept what worked, fixed what didn&apos;t. ~30 sec.
              </span>
            </div>
            {refineError && (
              <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {refineError}
              </p>
            )}
          </div>
        )}
      </footer>
    </article>
  )
}
