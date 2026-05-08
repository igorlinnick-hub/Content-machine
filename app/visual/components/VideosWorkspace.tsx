/* eslint-disable @next/next/no-img-element */
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { VideoListItem } from '@/lib/videos/store'

interface Props {
  clinicId: string
  videos: VideoListItem[]
}

interface GenerateResponse {
  video_id: string
  prompt: string
  public_url: string
  duration_sec: number
  aspect_ratio: string
  resolution: string
  replicate_model: string
  predict_time_sec: number
  category: { id: string; name: string; emoji: string | null } | null
}

export function VideosWorkspace({ clinicId, videos: initial }: Props) {
  const router = useRouter()
  const [videos, setVideos] = useState<VideoListItem[]>(initial)
  const [topic, setTopic] = useState('')
  const [duration, setDuration] = useState<5 | 8 | 10>(5)
  const [aspect, setAspect] = useState<'9:16' | '16:9' | '1:1' | '4:5'>('9:16')
  const [quality, setQuality] = useState<'lite' | 'pro'>('lite')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  async function generate() {
    if (!topic.trim()) {
      setGenError('Topic required')
      return
    }
    setGenerating(true)
    setGenError(null)
    try {
      const res = await fetch('/api/videos/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clinicId,
          topic: topic.trim(),
          duration,
          aspect,
          quality,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      const fresh = data as GenerateResponse
      const newItem: VideoListItem = {
        id: fresh.video_id,
        prompt: fresh.prompt,
        public_url: fresh.public_url,
        duration_sec: fresh.duration_sec,
        aspect_ratio: fresh.aspect_ratio,
        resolution: fresh.resolution,
        status: 'rendered',
        created_at: new Date().toISOString(),
        category: fresh.category,
      }
      setVideos((prev) => [newItem, ...prev])
      setTopic('')
      router.refresh()
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'failed to generate')
    } finally {
      setGenerating(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this video permanently?')) return
    try {
      const res = await fetch(`/api/videos/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? `HTTP ${res.status}`)
      }
      setVideos((prev) => prev.filter((v) => v.id !== id))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'failed to delete')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl border border-sky-200 bg-sky-50 p-5 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">
          New video (Seedance 2.0 via Replicate)
        </p>
        <div className="mt-3 flex flex-col gap-3">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Topic — e.g. ketamine therapy mechanism, glowing molecules entering neuron"
            className="cm-input text-sm"
            disabled={generating}
          />
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-700">
              Duration
            </span>
            {([5, 8, 10] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDuration(d)}
                disabled={generating}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  duration === d
                    ? 'border-sky-500 bg-sky-500 text-white'
                    : 'border-sky-200 bg-white text-sky-700 hover:border-sky-400'
                }`}
              >
                {d}s
              </button>
            ))}
            <span className="ml-2 text-[11px] font-semibold uppercase tracking-wider text-sky-700">
              Aspect
            </span>
            {(['9:16', '4:5', '1:1', '16:9'] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAspect(a)}
                disabled={generating}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  aspect === a
                    ? 'border-sky-500 bg-sky-500 text-white'
                    : 'border-sky-200 bg-white text-sky-700 hover:border-sky-400'
                }`}
              >
                {a}
              </button>
            ))}
            <span className="ml-2 text-[11px] font-semibold uppercase tracking-wider text-sky-700">
              Quality
            </span>
            {(['lite', 'pro'] as const).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setQuality(q)}
                disabled={generating}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  quality === q
                    ? 'border-sky-500 bg-sky-500 text-white'
                    : 'border-sky-200 bg-white text-sky-700 hover:border-sky-400'
                }`}
              >
                {q === 'lite' ? 'Lite (~$0.05/s)' : 'Pro (~$0.10/s)'}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-neutral-600">
              prompter (Haiku) → Seedance 2.0 {quality} → Supabase Storage. ~30-180 sec depending on duration + quality.
            </p>
            <button
              type="button"
              onClick={generate}
              disabled={generating || !topic.trim()}
              className="cm-btn cm-btn-primary text-sm"
            >
              {generating ? 'Generating…' : 'Generate'}
            </button>
          </div>
          {genError && (
            <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {genError}
            </p>
          )}
        </div>
      </section>

      {videos.length === 0 ? (
        <p className="cm-card p-6 text-sm text-neutral-500">
          No videos yet. Generate one above.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((v) => (
            <li key={v.id} className="cm-card overflow-hidden p-3">
              {v.public_url ? (
                <video
                  src={v.public_url}
                  controls
                  playsInline
                  className="w-full rounded-md bg-black"
                  style={{ aspectRatio: v.aspect_ratio?.replace(':', '/') ?? '9/16' }}
                />
              ) : (
                <div className="flex aspect-[9/16] items-center justify-center rounded-md bg-neutral-100 text-xs text-neutral-500">
                  {v.status === 'failed' ? 'Failed' : v.status}
                </div>
              )}
              <div className="mt-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="line-clamp-2 text-xs text-neutral-700">
                    {v.prompt.split('\n')[0]}
                  </p>
                  <p className="mt-0.5 text-[11px] text-neutral-500">
                    {v.duration_sec ?? '?'}s · {v.aspect_ratio ?? '?'} ·{' '}
                    {v.resolution ?? '?'}
                    {v.category ? ` · ${v.category.name}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {v.public_url && (
                    <a
                      href={v.public_url}
                      download={`video-${v.id}.mp4`}
                      className="text-[11px] font-medium text-sky-700 hover:text-sky-900"
                    >
                      Download
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(v.id)}
                    className="text-[11px] text-neutral-500 hover:text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
