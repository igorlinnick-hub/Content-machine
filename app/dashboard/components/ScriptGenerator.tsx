'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CriticScore, ScriptVariant } from '@/types'
import { ScriptCard } from './ScriptCard'

interface ScriptGeneratorProps {
  clinicId: string
}

interface GenerateResult {
  variants: ScriptVariant[]
  scores: CriticScore[]
  rewritten: boolean
  saved: Array<{ id: string; variant_id: string }>
}

export function ScriptGenerator({ clinicId }: ScriptGeneratorProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [topic, setTopic] = useState('')

  async function onGenerate() {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/agents/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clinicId,
          topicHint: topic.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      setResult(data as GenerateResult)
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
          <p className="text-sm text-neutral-600">
            Leave the topic blank to let your team pick from your pillars, or
            give them a specific topic.
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

      {result?.rewritten && (
        <p className="text-xs text-neutral-500">
          Rewritten once after critic feedback.
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {result && (
        <div className="grid gap-4 md:grid-cols-1">
          {result.variants.map((v) => {
            const score = result.scores.find((s) => s.variant_id === v.id)
            const savedRow = result.saved.find((s) => s.variant_id === v.id)
            const siblingIds = result.saved
              .filter((s) => s.variant_id !== v.id)
              .map((s) => s.id)
            return (
              <ScriptCard
                key={v.id}
                variant={v}
                score={score}
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
