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

  async function onGenerate() {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/agents/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clinicId }),
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onGenerate}
          disabled={loading}
          className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? 'Generating 3 variants…' : 'Generate 3 variants'}
        </button>
        {result?.rewritten && (
          <span className="text-xs text-neutral-500">
            Rewritten once after critic feedback.
          </span>
        )}
      </div>

      {error && (
        <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
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
