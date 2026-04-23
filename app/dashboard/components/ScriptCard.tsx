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
  variant,
  score,
  clinicId,
  scriptId,
  siblingScriptIds,
}: ScriptCardProps) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState>('idle')
  const [feedbackError, setFeedbackError] = useState<string | null>(null)
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

  const locked = feedback === 'selected' || feedback === 'rejected'
  const canFeedback = Boolean(clinicId && scriptId)

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

      <p className="rounded-lg border border-orange-100 bg-orange-50 px-4 py-3 text-sm italic text-orange-900">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider not-italic text-orange-500">
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

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          {canFeedback && (
            <>
              <button
                type="button"
                onClick={() => sendFeedback('selected')}
                disabled={locked || feedback === 'saving'}
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
                onClick={() => sendFeedback('rejected')}
                disabled={locked || feedback === 'saving'}
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
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="cm-btn cm-btn-ghost text-sm"
        >
          {copied ? 'Copied' : 'Copy script'}
        </button>
      </footer>
    </article>
  )
}
