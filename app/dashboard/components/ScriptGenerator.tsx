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
  const [exportingId, setExportingId] = useState<string | null>(null)
  const [docUrls, setDocUrls] = useState<Record<string, string>>({})

  async function onGenerate() {
    setLoading(true)
    setError(null)
    setResult(null)
    setDocUrls({})
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

  async function onExport(variantId: string) {
    if (!result) return
    const saved = result.saved.find((s) => s.variant_id === variantId)
    if (!saved) return
    setExportingId(variantId)
    try {
      const res = await fetch('/api/export/google', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scriptId: saved.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      setDocUrls((prev) => ({ ...prev, [variantId]: data.doc_url }))
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown error')
    } finally {
      setExportingId(null)
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
            return (
              <ScriptCard
                key={v.id}
                variant={v}
                score={score}
                googleDocUrl={docUrls[v.id] ?? null}
                onExport={() => onExport(v.id)}
                exporting={exportingId === v.id}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
