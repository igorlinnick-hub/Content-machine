'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface PlanTopic {
  id: string
  topic: string
  position: number
  status: 'pending' | 'done' | 'skipped'
  last_script_id: string | null
}

interface Props {
  clinicId: string
  initialTopics: PlanTopic[]
}

export function ContentPlan({ clinicId, initialTopics }: Props) {
  const router = useRouter()
  const [topics, setTopics] = useState<PlanTopic[]>(initialTopics)
  const [draft, setDraft] = useState(initialTopics.map((t) => t.topic).join('\n'))
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatingId, setGeneratingId] = useState<string | null>(null)

  useEffect(() => {
    if (!editing) setDraft(topics.map((t) => t.topic).join('\n'))
  }, [topics, editing])

  async function savePlan() {
    setSaving(true)
    setError(null)
    try {
      const list = draft
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
      const res = await fetch('/api/posts/plan', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clinicId, topics: list }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      setTopics(data.topics)
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function generate(topicId: string) {
    setGeneratingId(topicId)
    setError(null)
    try {
      const res = await fetch('/api/posts/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clinicId, topicId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      router.refresh()
      setTopics((prev) =>
        prev.map((t) =>
          t.id === topicId ? { ...t, status: 'done', last_script_id: data.script_id } : t
        )
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to generate')
    } finally {
      setGeneratingId(null)
    }
  }

  async function setStatus(topicId: string, status: 'pending' | 'done') {
    try {
      const res = await fetch(`/api/posts/plan/${topicId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      setTopics((prev) => prev.map((t) => (t.id === topicId ? data.topic : t)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to update')
    }
  }

  async function removeTopic(topicId: string) {
    if (!confirm('Remove this topic from the plan?')) return
    try {
      const res = await fetch(`/api/posts/plan/${topicId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? `HTTP ${res.status}`)
      }
      setTopics((prev) => prev.filter((t) => t.id !== topicId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to delete')
    }
  }

  return (
    <details className="rounded-lg border border-neutral-200 bg-white p-5" open>
      <summary className="cursor-pointer text-base font-semibold text-neutral-900">
        Topics ({topics.length})
        <span className="ml-2 text-xs font-normal text-neutral-500">
          — backbone of what you make content about. Click Generate on any topic.
        </span>
      </summary>

      <div className="mt-4 flex flex-col gap-4">
        <div className="flex justify-end">
          {!editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="cm-btn cm-btn-ghost text-xs"
            >
              Edit topics
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraft(topics.map((t) => t.topic).join('\n'))
                  setEditing(false)
                }}
                className="cm-btn cm-btn-ghost text-xs"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={savePlan}
                disabled={saving}
                className="cm-btn cm-btn-primary text-xs"
              >
                {saving ? 'Saving…' : 'Save topics'}
              </button>
            </div>
          )}
        </div>

        {editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.max(10, draft.split('\n').length + 2)}
            placeholder={
              'One topic per line, e.g.\nWhy PRP doesn’t work for smokers\nThe peptide that beat NSAIDs in our patients\n3 myths about stem cell knee injections'
            }
            className="cm-input font-mono text-sm"
          />
        ) : topics.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No topics yet. Click <em>Edit topics</em> and paste 10+ ideas — one per line.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-200">
            {topics.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-3">
                <StatusDot status={t.status} />
                <span
                  className={`flex-1 text-sm ${
                    t.status === 'done' ? 'text-neutral-500 line-through' : 'text-neutral-900'
                  }`}
                >
                  {t.topic}
                </span>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => generate(t.id)}
                    disabled={generatingId !== null}
                    className="cm-btn cm-btn-primary text-xs"
                  >
                    {generatingId === t.id
                      ? 'Generating…'
                      : t.status === 'done'
                        ? 'Regenerate'
                        : 'Generate'}
                  </button>
                  {t.status === 'done' && (
                    <button
                      type="button"
                      onClick={() => setStatus(t.id, 'pending')}
                      className="cm-btn cm-btn-ghost text-xs"
                    >
                      Reopen
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeTopic(t.id)}
                    className="cm-btn cm-btn-ghost text-xs text-red-600"
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}

        {generatingId && (
          <p className="text-xs text-neutral-500">
            Generating takes ~30-60 seconds (writer → critic → slides render).
          </p>
        )}
      </div>
    </details>
  )
}

function StatusDot({ status }: { status: 'pending' | 'done' | 'skipped' }) {
  const cls =
    status === 'done'
      ? 'bg-green-500'
      : status === 'skipped'
        ? 'bg-neutral-300'
        : 'bg-sky-400'
  return <span className={`h-2 w-2 shrink-0 rounded-full ${cls}`} aria-hidden />
}
