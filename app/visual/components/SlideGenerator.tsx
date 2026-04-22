'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { RecentScript } from '@/lib/supabase/context'
import { SlidePreview } from './SlidePreview'
import { PhotoPicker } from './PhotoPicker'

interface SlideGeneratorProps {
  scripts: RecentScript[]
}

interface GenerateResult {
  slide_set_id: string
  slide_count: number
  slides: string[]
  previews: string[]
  download_url: string
}

export function SlideGenerator({ scripts }: SlideGeneratorProps) {
  const router = useRouter()
  const [scriptId, setScriptId] = useState<string>(scripts[0]?.id ?? '')
  const [photoFolderId, setPhotoFolderId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<GenerateResult | null>(null)

  async function onGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!scriptId) {
      setError('Pick a script first.')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/visual/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          scriptId,
          photoFolderId: photoFolderId.trim() || undefined,
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

  if (scripts.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        Generate a script from the dashboard first.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={onGenerate}
        className="flex flex-col gap-3 rounded border border-neutral-200 bg-white p-4"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Source script</span>
          <select
            value={scriptId}
            onChange={(e) => setScriptId(e.target.value)}
            className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            {scripts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.topic ?? 'Untitled'} —{' '}
                {typeof s.critic_score === 'number'
                  ? `${s.critic_score.toFixed(1)}/10`
                  : 'unscored'}
              </option>
            ))}
          </select>
        </label>

        <PhotoPicker folderId={photoFolderId} onChange={setPhotoFolderId} />

        <div className="flex items-center justify-between gap-3">
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="ml-auto rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? 'Rendering slides…' : 'Generate slides'}
          </button>
        </div>
      </form>

      {result && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-sm">
            <p className="text-neutral-700">
              {result.slide_count} slides rendered
            </p>
            <a
              href={result.download_url}
              className="rounded border border-neutral-300 px-3 py-1.5 text-xs hover:bg-neutral-50"
            >
              Download ZIP
            </a>
          </div>
          <SlidePreview slides={result.slides} previews={result.previews} />
        </div>
      )}
    </div>
  )
}
