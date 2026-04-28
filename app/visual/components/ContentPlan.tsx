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
  initialPhotoFolderId?: string
}

export function ContentPlan({ clinicId, initialTopics, initialPhotoFolderId }: Props) {
  const router = useRouter()
  const [topics, setTopics] = useState<PlanTopic[]>(initialTopics)
  const [draft, setDraft] = useState(initialTopics.map((t) => t.topic).join('\n'))
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [photoFolderId, setPhotoFolderId] = useState(initialPhotoFolderId ?? '')
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
        body: JSON.stringify({
          clinicId,
          topicId,
          photoFolderId: photoFolderId.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      // refresh server-rendered list of posts + plan statuses
      router.refresh()
      // also patch local state to mark this topic done
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
    <section className="cm-card flex flex-col gap-4 p-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Content plan</h2>
          <p className="mt-0.5 text-sm text-neutral-600">
            One topic per line. Click <em>Generate</em> on any topic to produce a finished post.
          </p>
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="cm-btn cm-btn-ghost text-xs"
          >
            Edit plan
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
              {saving ? 'Saving…' : 'Save plan'}
            </button>
          </div>
        )}
      </header>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-500">
          Drive folder ID for photo backgrounds (optional)
        </span>
        <input
          type="text"
          value={photoFolderId}
          onChange={(e) => setPhotoFolderId(e.target.value)}
          placeholder="e.g. 1aBc...XYZ"
          className="cm-input text-sm"
        />
      </label>

      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={Math.max(8, draft.split('\n').length + 2)}
          placeholder={
            'Why PRP doesn’t work for smokers\nThe peptide that beat NSAIDs in our patients\n3 myths about stem cell knee injections'
          }
          className="cm-input font-mono text-sm"
        />
      ) : topics.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Plan is empty. Click <em>Edit plan</em> to add topics.
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
    </section>
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
