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
  const approved = score?.approved ?? false
  const total = score?.total_score

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

  const feedbackLocked = feedback === 'selected' || feedback === 'rejected'
  const canFeedback = Boolean(clinicId && scriptId)

  return (
    <article className="flex flex-col gap-3 rounded border border-neutral-200 bg-white p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">
            {variant.id} · {variant.word_count} words · ~{variant.estimated_seconds}s
          </p>
          <h3 className="mt-1 text-base font-semibold">{variant.topic}</h3>
        </div>
        {typeof total === 'number' && (
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              approved
                ? 'bg-green-100 text-green-800'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            {total.toFixed(1)}/10 · {approved ? 'approved' : 'needs review'}
          </span>
        )}
      </header>

      <p className="text-sm italic text-neutral-700">Hook: {variant.hook}</p>

      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-neutral-900">
        {variant.script}
      </pre>

      {score && (
        <details className="text-xs text-neutral-600">
          <summary className="cursor-pointer">Critic detail</summary>
          <ul className="mt-2 space-y-1">
            <li>tone_match: {score.criteria.tone_match}</li>
            <li>no_promises: {score.criteria.no_promises}</li>
            <li>hook_quality: {score.criteria.hook_quality}</li>
            <li>length_ok: {score.criteria.length_ok}</li>
            <li>science_present: {score.criteria.science_present}</li>
          </ul>
          <p className="mt-2">{score.feedback}</p>
        </details>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-3 text-xs">
        <div className="flex items-center gap-2">
          {canFeedback && (
            <>
              <button
                type="button"
                onClick={() => sendFeedback('selected')}
                disabled={feedbackLocked || feedback === 'saving'}
                className={`rounded px-3 py-1 font-medium ${
                  feedback === 'selected'
                    ? 'bg-orange-500 text-white'
                    : 'bg-orange-100 text-orange-800 hover:bg-orange-200 disabled:opacity-50'
                }`}
              >
                {feedback === 'selected' ? 'Picked' : 'Pick this'}
              </button>
              <button
                type="button"
                onClick={() => sendFeedback('rejected')}
                disabled={feedbackLocked || feedback === 'saving'}
                className={`rounded border px-3 py-1 ${
                  feedback === 'rejected'
                    ? 'border-neutral-400 bg-neutral-100 text-neutral-600'
                    : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50 disabled:opacity-50'
                }`}
              >
                {feedback === 'rejected' ? 'Passed' : 'Pass'}
              </button>
            </>
          )}
          {feedbackError && (
            <span className="text-red-600">{feedbackError}</span>
          )}
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="rounded border border-neutral-300 px-2 py-1 text-neutral-700 hover:bg-neutral-50"
        >
          {copied ? 'Copied' : 'Copy script'}
        </button>
      </footer>
    </article>
  )
}
