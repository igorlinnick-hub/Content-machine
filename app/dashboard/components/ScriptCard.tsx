'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CriticScore, ScriptVariant, ComplianceResult } from '@/types'

type FeedbackState = 'idle' | 'saving' | 'selected' | 'rejected' | 'error'

interface ScriptCardProps {
  variant: ScriptVariant
  score?: CriticScore
  compliance?: ComplianceResult | null
  clinicId?: string
  scriptId?: string
  siblingScriptIds?: string[]
  isAdmin?: boolean
}

export function ScriptCard({
  variant: initialVariant,
  score: initialScore,
  compliance,
  clinicId,
  scriptId: initialScriptId,
}: ScriptCardProps) {
  const router = useRouter()
  const [variant, setVariant] = useState<ScriptVariant>(initialVariant)
  const [score] = useState<CriticScore | undefined>(initialScore)
  const [complianceState, setComplianceState] = useState<ComplianceResult | null>(
    compliance ?? null
  )
  const [scriptId, setScriptId] = useState<string | undefined>(initialScriptId)
  const [scriptText, setScriptText] = useState(initialVariant.script)
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState>('idle')
  const [feedbackError, setFeedbackError] = useState<string | null>(null)
  const [refineOpen, setRefineOpen] = useState(false)
  const [refineNote, setRefineNote] = useState('')
  const [refining, setRefining] = useState(false)
  const [refineError, setRefineError] = useState<string | null>(null)
  const [refineCount, setRefineCount] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const total = score?.total_score
  const strong = typeof total === 'number' && total >= 7

  const grade = complianceState?.grade ?? null

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(scriptText)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* older browsers */ }
  }

  async function sendFeedback(action: 'rejected') {
    if (!clinicId || !scriptId) return
    setFeedback('saving')
    setFeedbackError(null)
    try {
      const res = await fetch('/api/scripts/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clinicId, scriptId, action, siblingIds: [] }),
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
        body: JSON.stringify({ clinicId, scriptId, note: refineNote.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      if (data.variant) {
        setVariant(data.variant as ScriptVariant)
        setScriptText((data.variant as ScriptVariant).script)
      }
      if (data.scriptId) setScriptId(data.scriptId as string)
      // Refined script went through its own compliance cycle — swap the
      // verdict; keeping the old one would describe a script that no
      // longer exists.
      setComplianceState((data.compliance as ComplianceResult | null) ?? null)
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

  const locked = feedback === 'rejected'
  const canFeedback = Boolean(clinicId && scriptId)
  const canRefine = canFeedback && !locked && !refining

  return (
    <article className="cm-card flex flex-col gap-4 p-5 sm:p-6">
      {/* Header */}
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
              strong ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {total.toFixed(1)} / 10
          </span>
        )}
      </header>

      {/* Script */}
      <textarea
        ref={textareaRef}
        value={scriptText}
        onChange={(e) => setScriptText(e.target.value)}
        spellCheck={false}
        className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-4 font-sans text-[15px] leading-relaxed text-neutral-900 outline-none transition-colors hover:border-neutral-300 focus:border-neutral-400 focus:bg-white focus:ring-2 focus:ring-neutral-100"
        style={{ minHeight: 200, maxHeight: 400, overflowY: 'auto', resize: 'none' }}
      />

      {/* REMOVE grade only — genuine publish block that the loop cannot auto-fix */}
      {grade === 'REMOVE' && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-red-500">✕</span>
            <span className="text-sm font-semibold text-red-800">Cannot publish — medical director review required</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="flex flex-col gap-3 border-t border-neutral-100 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {canFeedback && (
              <>
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
                    locked ? 'cm-btn-danger' : 'cm-btn-danger-outline'
                  }`}
                >
                  {locked ? '✕ Passed' : 'Pass'}
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
          <div className="flex items-center gap-2">
            {clinicId && scriptId && (
              <button
                type="button"
                onClick={() => router.push(`/teleprompter?clinicId=${clinicId}&scriptId=${scriptId}`)}
                className="cm-btn cm-btn-ghost text-sm"
              >
                Teleprompter →
              </button>
            )}
            <button
              type="button"
              onClick={onCopy}
              className="cm-btn cm-btn-ghost text-sm"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

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
