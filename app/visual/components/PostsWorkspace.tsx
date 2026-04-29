/* eslint-disable @next/next/no-img-element */
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PostListItem } from '@/lib/visual/store'

interface Props {
  clinicId: string
  posts: PostListItem[]
}

interface PostDetail {
  slide_set_id: string
  topic: string | null
  hook: string | null
  script: string | null
  slides: string[]
  previews: string[]
  created_at: string
}

export function PostsWorkspace({ posts }: Props) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(
    posts[0]?.slide_set_id ?? null
  )
  const [detail, setDetail] = useState<PostDetail | null>(null)
  const [drafts, setDrafts] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      setDrafts((data.slides as string[]).slice())
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
      drafts.some((s, i) => s !== detail.slides[i]))

  return (
    <div className="grid min-h-[calc(100vh-160px)] grid-cols-1 gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="cm-card flex max-h-[calc(100vh-160px)] flex-col overflow-hidden">
        <header className="border-b border-neutral-200 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-500">
            Posts
          </p>
          <p className="text-xs text-neutral-500">{posts.length} total</p>
        </header>
        {posts.length === 0 ? (
          <p className="p-4 text-sm text-neutral-500">
            No posts yet. Generate one from the dashboard.
          </p>
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
            Pick a post on the left to edit and download.
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
                <button
                  type="button"
                  onClick={save}
                  disabled={!dirty || saving}
                  className="cm-btn cm-btn-primary text-sm"
                >
                  {saving ? 'Saving…' : 'Save & re-render'}
                </button>
                <a
                  href={`/api/visual/download?slideSetId=${detail.slide_set_id}`}
                  className="cm-btn cm-btn-ghost text-sm"
                >
                  Download ZIP
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

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                  Slides — edit text
                </p>
                <ul className="flex flex-col gap-3">
                  {drafts.map((text, i) => (
                    <li key={i} className="cm-card p-3">
                      <div className="mb-2 flex items-center justify-between text-xs text-neutral-500">
                        <span className="font-semibold uppercase tracking-wider">
                          Slide {i + 1}
                        </span>
                        <span>{text.length} chars</span>
                      </div>
                      <textarea
                        value={text}
                        onChange={(e) => {
                          const next = drafts.slice()
                          next[i] = e.target.value
                          setDrafts(next)
                        }}
                        rows={3}
                        className="cm-input resize-none text-sm"
                      />
                    </li>
                  ))}
                </ul>
                {dirty && (
                  <p className="text-xs text-amber-700">
                    Unsaved changes — click <em>Save &amp; re-render</em> to update previews.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                  Preview
                </p>
                {detail.previews.length === 0 ? (
                  <p className="text-sm text-neutral-500">No previews yet.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {detail.previews.map((src, i) => (
                      <figure
                        key={i}
                        className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm"
                      >
                        <img
                          src={src}
                          alt={`Slide ${i + 1}`}
                          className="aspect-square w-full object-cover"
                        />
                        <figcaption className="border-t border-neutral-100 px-2 py-1.5 text-[11px] text-neutral-500">
                          Slide {i + 1}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </section>
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
