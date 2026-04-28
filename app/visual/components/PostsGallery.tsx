'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PostListItem } from '@/lib/visual/store'

interface Props {
  posts: PostListItem[]
}

export function PostsGallery({ posts }: Props) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  async function remove(slideSetId: string) {
    if (!confirm('Delete this post permanently?')) return
    setDeletingId(slideSetId)
    setError(null)
    try {
      const res = await fetch(`/api/posts/${slideSetId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? `HTTP ${res.status}`)
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to delete')
    } finally {
      setDeletingId(null)
    }
  }

  if (posts.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        No posts yet. Generate one from a topic above.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {posts.map((p) => {
          const expanded = expandedId === p.slide_set_id
          return (
            <li
              key={p.slide_set_id}
              className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-neutral-900">
                    {p.topic ?? 'Untitled'}
                  </p>
                  {p.hook && (
                    <p className="mt-1 line-clamp-2 text-xs text-neutral-500">
                      {p.hook}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-neutral-400">
                    {p.slide_count} slides ·{' '}
                    {new Date(p.created_at).toLocaleString()}
                  </p>
                </div>
                {p.category && (
                  <span className="shrink-0 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700">
                    {p.category.emoji && <span className="mr-1">{p.category.emoji}</span>}
                    {p.category.name}
                  </span>
                )}
              </div>

              {expanded && p.script && (
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-neutral-50 p-3 text-xs text-neutral-700">
                  {p.script}
                </pre>
              )}

              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedId(expanded ? null : p.slide_set_id)
                  }
                  className="cm-btn cm-btn-ghost text-xs"
                >
                  {expanded ? 'Hide script' : 'Show script'}
                </button>
                <a
                  href={`/api/visual/download?slideSetId=${p.slide_set_id}`}
                  className="cm-btn cm-btn-primary text-xs"
                >
                  Download ZIP
                </a>
                <button
                  type="button"
                  onClick={() => remove(p.slide_set_id)}
                  disabled={deletingId === p.slide_set_id}
                  className="cm-btn cm-btn-ghost text-xs text-red-600"
                >
                  {deletingId === p.slide_set_id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
