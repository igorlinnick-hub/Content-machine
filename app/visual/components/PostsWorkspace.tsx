/* eslint-disable @next/next/no-img-element */
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PostListItem } from '@/lib/visual/store'
import { SlideEditor, type UISlide } from './SlideEditor'

interface Props {
  clinicId: string
  posts: PostListItem[]
}

interface PostDetail {
  slide_set_id: string
  topic: string | null
  hook: string | null
  script: string | null
  slides: UISlide[]
  previews: string[]
  created_at: string
}

interface GenerateResponse {
  slide_set_id: string | null
  script_id: string
  topic: string
  hook: string
  script: string
  slides: UISlide[]
  previews: string[]
  category: { id: string; name: string; emoji: string | null } | null
  pair_id: string | null
  length_target: 'short' | 'long'
}

export function PostsWorkspace({ clinicId, posts: initialPosts }: Props) {
  const router = useRouter()
  const [posts, setPosts] = useState<PostListItem[]>(initialPosts)
  const [selectedId, setSelectedId] = useState<string | null>(
    initialPosts[0]?.slide_set_id ?? null
  )
  const [detail, setDetail] = useState<PostDetail | null>(null)
  const [drafts, setDrafts] = useState<UISlide[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [topic, setTopic] = useState('')
  const [note, setNote] = useState('')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      setDrafts([])
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    setDetail(null)
    ;(async () => {
      try {
        const res = await fetch(`/api/posts/${selectedId}`)
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
        setDetail(data as PostDetail)
        setDrafts(((data as PostDetail).slides ?? []).slice())
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedId])

  async function generate() {
    if (!topic.trim()) {
      setGenError('Topic required')
      return
    }
    setGenerating(true)
    setGenError(null)
    try {
      const res = await fetch('/api/posts/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clinicId,
          topic: topic.trim(),
          note: note.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      const fresh = data as GenerateResponse

      if (fresh.slide_set_id) {
        const newItem: PostListItem = {
          slide_set_id: fresh.slide_set_id,
          script_id: fresh.script_id,
          topic: fresh.topic,
          hook: fresh.hook,
          script: fresh.script,
          slide_count: fresh.slides.length,
          status: 'rendered',
          created_at: new Date().toISOString(),
          length_target: fresh.length_target,
          pair_id: fresh.pair_id,
          category: fresh.category,
        }
        setPosts((prev) => [newItem, ...prev])
        setSelectedId(fresh.slide_set_id)
        setDetail({
          slide_set_id: fresh.slide_set_id,
          topic: fresh.topic,
          hook: fresh.hook,
          script: fresh.script,
          slides: fresh.slides,
          previews: fresh.previews,
          created_at: newItem.created_at,
        })
        setDrafts(fresh.slides.slice())
        setLoading(false)
      }
      setTopic('')
      setNote('')
      router.refresh()
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'failed to generate')
    } finally {
      setGenerating(false)
    }
  }

  async function save() {
    if (!selectedId) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/posts/${selectedId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slides: drafts }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      setDetail((d) =>
        d
          ? { ...d, slides: data.slides ?? d.slides, previews: data.previews ?? d.previews }
          : d
      )
      setDrafts((data.slides as UISlide[]).slice())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!selectedId) return
    if (!confirm('Delete this post permanently?')) return
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/posts/${selectedId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? `HTTP ${res.status}`)
      }
      const remaining = posts.filter((p) => p.slide_set_id !== selectedId)
      setPosts(remaining)
      setSelectedId(remaining[0]?.slide_set_id ?? null)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  const dirty =
    detail !== null &&
    (drafts.length !== detail.slides.length ||
      drafts.some((s, i) => {
        const o = detail.slides[i]
        return (
          !o ||
          s.kind !== o.kind ||
          s.text !== o.text ||
          (s.chip ?? null) !== (o.chip ?? null) ||
          (s.subtext ?? null) !== (o.subtext ?? null)
        )
      }))

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl border border-sky-200 bg-sky-50 p-5 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">
          New post
        </p>
        <div className="mt-3 flex flex-col gap-3">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Topic — e.g. ketamine for treatment-resistant depression"
            className="cm-input text-sm"
            disabled={generating}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !generating && (e.metaKey || e.ctrlKey)) generate()
            }}
          />
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional starting note — paste any rough thoughts, a key fact, the angle you want. Leave blank to let the team pick."
            rows={3}
            className="cm-input resize-none text-sm"
            disabled={generating}
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-neutral-600">
              Writer + critic + slide splitter run on the backend. ~3-5 min for a finished carousel.
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

      <div className="grid min-h-[calc(100vh-280px)] grid-cols-1 gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="cm-card flex max-h-[calc(100vh-280px)] flex-col overflow-hidden">
          <header className="border-b border-neutral-200 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-500">
              Recent posts
            </p>
            <p className="text-xs text-neutral-500">{posts.length} total</p>
          </header>
          {posts.length === 0 ? (
            <p className="p-4 text-sm text-neutral-500">No posts yet.</p>
          ) : (
            <ul className="flex-1 overflow-y-auto">
              {posts.map((p) => {
                const active = p.slide_set_id === selectedId
                return (
                  <li key={p.slide_set_id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(p.slide_set_id)}
                      className={`w-full border-b border-neutral-200 px-4 py-3 text-left transition ${
                        active ? 'bg-sky-50' : 'hover:bg-neutral-50'
                      }`}
                    >
                      <p
                        className={`line-clamp-2 text-sm font-medium ${
                          active ? 'text-sky-900' : 'text-neutral-900'
                        }`}
                      >
                        {p.topic ?? 'Untitled'}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {formatDate(p.created_at)} · {p.slide_count} slides
                      </p>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>

        <section className="flex min-w-0 flex-col gap-5">
          {!selectedId ? (
            <div className="cm-card flex flex-1 items-center justify-center p-8 text-sm text-neutral-500">
              Generate a post above — it will open here.
            </div>
          ) : loading ? (
            <div className="cm-card flex flex-1 items-center justify-center p-8 text-sm text-neutral-500">
              Loading post…
            </div>
          ) : !detail ? (
            <div className="cm-card flex flex-1 items-center justify-center p-8 text-sm text-red-600">
              {error ?? 'Failed to load post.'}
            </div>
          ) : (
            <>
              <header className="flex flex-col gap-3 border-b border-neutral-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold text-neutral-900">
                    {detail.topic ?? 'Untitled post'}
                  </h2>
                  <p className="mt-1 text-xs text-neutral-500">
                    {formatDate(detail.created_at)} · {detail.slides.length} slides
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {dirty && (
                    <button
                      type="button"
                      onClick={save}
                      disabled={saving}
                      className="cm-btn cm-btn-primary text-sm"
                    >
                      {saving ? 'Saving…' : 'Save & re-render'}
                    </button>
                  )}
                  <a
                    href={`/api/visual/download?slideSetId=${detail.slide_set_id}`}
                    className="cm-btn cm-btn-primary text-sm"
                  >
                    Download
                  </a>
                  <button
                    type="button"
                    onClick={remove}
                    disabled={deleting}
                    className="cm-btn cm-btn-ghost text-sm text-red-600"
                  >
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </header>

              {error && (
                <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </p>
              )}

              <ul className="flex flex-col gap-3">
                {drafts.map((slide, i) => (
                  <SlideEditor
                    key={i}
                    slideSetId={detail.slide_set_id}
                    index={i}
                    slide={slide}
                    preview={detail.previews[i] ?? null}
                    onSlideChange={(next) => {
                      const arr = drafts.slice()
                      arr[i] = next
                      setDrafts(arr)
                    }}
                    onAIFix={({ slide: nextSlide, preview }) => {
                      const arr = drafts.slice()
                      arr[i] = nextSlide
                      setDrafts(arr)
                      setDetail((d) => {
                        if (!d) return d
                        const slides = d.slides.slice()
                        slides[i] = nextSlide
                        const previews = d.previews.slice()
                        previews[i] = preview
                        return { ...d, slides, previews }
                      })
                    }}
                  />
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
