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
  siblingScriptIds,
  isAdmin = false,
}: ScriptCardProps) {
  const router = useRouter()
  const [variant, setVariant] = useState<ScriptVariant>(initialVariant)
  const [score] = useState<CriticScore | undefined>(initialScore)
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

  const grade = compliance?.grade ?? null
  const complianceStyle =
    grade === 'REMOVE'
      ? { border: 'border-red-200',    bg: 'bg-red-50',    icon: '✕', iconCls: 'text-red-500',    label: 'Cannot publish',  labelCls: 'text-red-800'    }
      : grade === 'REWORD'
        ? { border: 'border-orange-200', bg: 'bg-orange-50', icon: '⚠', iconCls: 'text-orange-500', label: 'Reword required', labelCls: 'text-orange-800' }
        : grade === 'REVIEW'
          ? { border: 'border-amber-200',  bg: 'bg-amber-50',  icon: '⚠', iconCls: 'text-amber-500',  label: 'Review needed',   labelCls: 'text-amber-800'  }
          : grade === 'PASS'
            ? { border: 'border-emerald-200', bg: 'bg-emerald-50', icon: '✓', iconCls: 'text-emerald-500', label: 'Compliant', labelCls: 'text-emerald-800' }
            : null

  function autoResize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

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

      {/* Hook */}
      <p className="rounded-lg border border-sky-100 bg-sky-50 px-4 py-3 text-sm italic text-sky-900">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider not-italic text-sky-500">
          Hook
        </span>
        {variant.hook}
      </p>

      {/* Script — click to edit */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={scriptText}
          onChange={(e) => { setScriptText(e.target.value); autoResize() }}
          onFocus={autoResize}
          spellCheck={false}
          className="w-full resize-none rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-4 font-sans text-[15px] leading-relaxed text-neutral-900 outline-none transition-colors hover:border-neutral-300 focus:border-sky-300 focus:bg-white focus:ring-2 focus:ring-sky-100"
          rows={1}
          style={{ overflow: 'hidden' }}
        />
        <span className="pointer-events-none absolute bottom-2 right-3 text-[10px] text-neutral-300 select-none">
          click to edit
        </span>
      </div>

      {/* Compliance signal */}
      {compliance && !isAdmin && (grade === 'PASS' || grade === 'REVIEW') && (
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-700">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Compliant
        </span>
      )}
      {compliance && isAdmin && complianceStyle && (
        /* Admin: full details with rule IDs and corrections */
        <div className={`rounded-xl border ${complianceStyle.border} ${complianceStyle.bg} px-4 py-3`}>
          <div className="flex items-center gap-2">
            <span className={`text-base font-bold ${complianceStyle.iconCls}`}>
              {complianceStyle.icon}
            </span>
            <span className={`text-sm font-semibold ${complianceStyle.labelCls}`}>
              {complianceStyle.label}
            </span>
            {compliance.findings.length > 0 && (
              <span className={`ml-auto text-xs ${complianceStyle.labelCls} opacity-70`}>
                {compliance.findings.length} finding{compliance.findings.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {compliance.findings.length > 0 && (
            <details className="mt-2">
              <summary className={`cursor-pointer text-xs font-medium ${complianceStyle.labelCls} opacity-80 hover:opacity-100`}>
                Show details
              </summary>
              <ul className="mt-2 flex flex-col gap-2.5">
                {compliance.findings.map((f, i) => (
                  <li key={i} className="flex flex-col gap-0.5 text-xs">
                    <span className={`font-semibold ${
                      f.severity === 'remove' ? 'text-red-700' :
                      f.severity === 'reword' ? 'text-orange-700' : 'text-amber-700'
                    }`}>
                      [{f.rule}] {f.severity.toUpperCase()}
                    </span>
                    <span className="italic text-neutral-600">&ldquo;{f.matched}&rdquo;</span>
                    <span className="text-neutral-500">→ {f.correction}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
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
          <button
            type="button"
            onClick={onCopy}
            className="cm-btn cm-btn-ghost text-sm"
          >
            {copied ? 'Copied' : 'Copy script'}
          </button>
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
