'use client'

import type { CriticScore, ScriptVariant } from '@/types'

interface ScriptCardProps {
  variant: ScriptVariant
  score?: CriticScore
  googleDocUrl?: string | null
  onExport?: () => void
  exporting?: boolean
}

export function ScriptCard({
  variant,
  score,
  googleDocUrl,
  onExport,
  exporting,
}: ScriptCardProps) {
  const approved = score?.approved ?? false
  const total = score?.total_score

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

      <footer className="flex items-center justify-end gap-3 border-t border-neutral-100 pt-3 text-xs">
        {googleDocUrl ? (
          <a
            href={googleDocUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded border border-neutral-300 px-2 py-1 text-neutral-700 hover:bg-neutral-50"
          >
            Open Google Doc
          </a>
        ) : onExport ? (
          <button
            type="button"
            onClick={onExport}
            disabled={exporting}
            className="rounded border border-neutral-300 px-2 py-1 text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
          >
            {exporting ? 'Exporting…' : 'Export to Google Doc'}
          </button>
        ) : null}
      </footer>
    </article>
  )
}
