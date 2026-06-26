'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  clinicId: string
}

export function GeneratePlanButton({ clinicId }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleGenerate() {
    if (!confirm('Generate an AI content plan? This will replace the current plan for this clinic.')) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/content-plan/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clinicId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        className="shrink-0 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-60"
      >
        {loading ? 'Generating…' : '✨ Generate plan with AI'}
      </button>
      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  )
}
