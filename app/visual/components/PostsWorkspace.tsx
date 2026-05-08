/* eslint-disable @next/next/no-img-element */
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PostListItem } from '@/lib/visual/store'
import { CategoriesEditor } from './CategoriesEditor'
import { ContentPlan } from './ContentPlan'
import { FewShotEditor } from './FewShotEditor'
import { PostReferencesEditor } from './PostReferencesEditor'
import { TemplatesEditor, type TemplateItem } from './TemplatesEditor'
import { SlideEditor } from './SlideEditor'

interface PlanTopic {
  id: string
  topic: string
  position: number
  status: 'pending' | 'done' | 'skipped'
  last_script_id: string | null
}

interface Category {
  id?: string
  slug: string
  name: string
  emoji: string | null
  triggers: string[]
  drive_folder_id: string | null
  cta_template: string | null
}

interface FewShotItem {
  id: string
  script_text: string
  why_good: string | null
  topic: string | null
  score: number | null
}

interface ReferenceItem {
  id: string
  image_url: string
  label: string | null
  mode: 'photo' | 'clean' | null
  role: 'cover' | 'body' | 'cta' | 'full_post' | null
  category_slug: string | null
  notes: string | null
}

interface Props {
  clinicId: string
  posts: PostListItem[]
  plan: PlanTopic[]
  categories: Category[]
  fewShot: FewShotItem[]
  references: ReferenceItem[]
  templates: TemplateItem[]
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

interface GenerateResponse {
  slide_set_id: string | null
  script_id: string
  topic: string
  hook: string
  script: string
  slides: string[]
  previews: string[]
  category: { id: string; name: string; emoji: string | null } | null
  pair_id: string | null
  length_target: 'short' | 'long'
}

type LengthChoice = 'short' | 'long' | 'both'

export function PostsWorkspace({
  clinicId,
  posts: initialPosts,
  plan,
  categories,
  fewShot,
  references,
  templates,
}: Props) {
  const router = useRouter()
  const [posts, setPosts] = useState<PostListItem[]>(initialPosts)
  const [selectedId, setSelectedId] = useState<string | null>(
    initialPosts[0]?.slide_set_id ?? null
  )
  const [detail, setDetail] = useState<PostDetail | null>(null)
  const [drafts, setDrafts] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Generation panel state
  const [topic, setTopic] = useState('')
  const [length, setLength] = useState<LengthChoice>('short')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  // Gallery filters
  const [filterCategoryId, setFilterCategoryId] = useState<string | 'all'>('all')
  const [filterLength, setFilterLength] = useState<'all' | 'short' | 'long'>('all')

  const filteredPosts = posts.filter((p) => {
    if (filterCategoryId !== 'all' && p.category?.id !== filterCategoryId) return false
    if (filterLength !== 'all' && p.length_target !== filterLength) return false
    return true
  })

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
    setGenerating(true)
    setGenError(null)
    try {
      const res = await fetch('/api/posts/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clinicId,
          topic: topic.trim() || undefined,
          length,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      const fresh = data as GenerateResponse

      // Inject into local list immediately so user sees it without round-trip.
      // If only short was rendered (long is text-only), we still get a slide_set_id.
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
        // Skip the GET fetch — we already have everything.
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
      drafts.some((s, i) => s !== detail.slides[i]))

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-500">
            Library & plan
          </p>
          <p className="mt-1 text-sm text-neutral-600">
            Topics drive what to make. Golden scripts and posts teach the AI how
            it should sound and look. Categories route a topic to its photo folder + CTA.
          </p>
        </header>
        <ContentPlan clinicId={clinicId} initialTopics={plan} />
        <TemplatesEditor clinicId={clinicId} initialTemplates={templates} />
        <FewShotEditor clinicId={clinicId} initialExamples={fewShot} />
        <PostReferencesEditor
          clinicId={clinicId}
          initialReferences={references}
          categorySlugs={categories.map((c) => ({ slug: c.slug, name: c.name }))}
        />
        <CategoriesEditor clinicId={clinicId} initialCategories={categories} />
      </section>

      <section className="rounded-2xl border border-sky-200 bg-sky-50 p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">
              Generate new post
            </span>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Topic (e.g. ketamine for treatment-resistant depression). Leave blank to let the team pick from your pillars."
              className="cm-input text-sm"
              disabled={generating}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !generating) generate()
              }}
            />
          </label>
          <button
            type="button"
            onClick={generate}
            disabled={generating}
            className="cm-btn cm-btn-primary text-sm"
          >
            {generating ? 'Generating…' : 'Generate'}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-sky-700">
            Length
          </span>
          {(
            [
              { id: 'short', label: 'Short — 60-90s boost' },
              { id: 'long', label: 'Long — 2-3min organic' },
              { id: 'both', label: 'Both (paired)' },
            ] as Array<{ id: LengthChoice; label: string }>
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              disabled={generating}
              onClick={() => setLength(opt.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                length === opt.id
                  ? 'border-sky-500 bg-sky-500 text-white'
                  : 'border-sky-200 bg-white text-sky-700 hover:border-sky-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-neutral-600">
          Writer drafts 3 variants per length using your format templates, critic picks the highest, the short version becomes a carousel. Long version stays text-only — render it later from the post page.
        </p>
        {genError && (
          <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {genError}
          </p>
        )}
      </section>

      <div className="grid min-h-[calc(100vh-280px)] grid-cols-1 gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="cm-card flex max-h-[calc(100vh-280px)] flex-col overflow-hidden">
          <header className="flex flex-col gap-2 border-b border-neutral-200 px-4 py-3">
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-500">
                Posts
              </p>
              <p className="text-xs text-neutral-500">
                {filteredPosts.length} / {posts.length}
              </p>
            </div>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setFilterCategoryId('all')}
                className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition ${
                  filterCategoryId === 'all'
                    ? 'border-sky-500 bg-sky-500 text-white'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:border-sky-300'
                }`}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c.id ?? c.slug}
                  type="button"
                  onClick={() => c.id && setFilterCategoryId(c.id)}
                  disabled={!c.id}
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition ${
                    filterCategoryId === c.id
                      ? 'border-sky-500 bg-sky-500 text-white'
                      : 'border-neutral-200 bg-white text-neutral-700 hover:border-sky-300'
                  }`}
                  title={c.name}
                >
                  {c.emoji ? `${c.emoji} ` : ''}
                  {c.name}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {(['all', 'short', 'long'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setFilterLength(opt)}
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition ${
                    filterLength === opt
                      ? 'border-sky-500 bg-sky-500 text-white'
                      : 'border-neutral-200 bg-white text-neutral-700 hover:border-sky-300'
                  }`}
                >
                  {opt === 'all' ? 'Any length' : opt === 'short' ? 'Short' : 'Long'}
                </button>
              ))}
            </div>
          </header>
          {filteredPosts.length === 0 ? (
            <p className="p-4 text-sm text-neutral-500">
              {posts.length === 0
                ? 'No posts yet. Generate one above.'
                : 'No posts match the current filters.'}
            </p>
          ) : (
            <ul className="flex-1 overflow-y-auto">
              {filteredPosts.map((p) => {
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
                      <div className="flex items-start gap-2">
                        <p
                          className={`line-clamp-2 flex-1 text-sm font-medium ${
                            active ? 'text-sky-900' : 'text-neutral-900'
                          }`}
                        >
                          {p.topic ?? 'Untitled'}
                        </p>
                        {p.length_target && (
                          <span className="shrink-0 rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-600">
                            {p.length_target}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {p.category?.name ? `${p.category.name} · ` : ''}
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

              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                  Slides — edit text or ask AI to fix any single slide
                </p>
                <ul className="flex flex-col gap-3">
                  {drafts.map((text, i) => (
                    <SlideEditor
                      key={i}
                      slideSetId={detail.slide_set_id}
                      index={i}
                      text={text}
                      preview={detail.previews[i] ?? null}
                      onTextChange={(next) => {
                        const arr = drafts.slice()
                        arr[i] = next
                        setDrafts(arr)
                      }}
                      onAIFix={({ text: nextText, preview }) => {
                        const arr = drafts.slice()
                        arr[i] = nextText
                        setDrafts(arr)
                        setDetail((d) => {
                          if (!d) return d
                          const slides = d.slides.slice()
                          slides[i] = nextText
                          const previews = d.previews.slice()
                          previews[i] = preview
                          return { ...d, slides, previews }
                        })
                      }}
                    />
                  ))}
                </ul>
                {dirty && (
                  <p className="text-xs text-amber-700">
                    Manual edits — click <em>Save &amp; re-render</em> to commit them. AI fixes save immediately.
                  </p>
                )}
              </div>
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
