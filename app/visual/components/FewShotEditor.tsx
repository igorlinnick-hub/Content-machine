'use client'

import { useState } from 'react'

interface Example {
  id: string
  script_text: string
  why_good: string | null
  topic: string | null
  score: number | null
}

interface Props {
  clinicId: string
  initialExamples: Example[]
}

export function FewShotEditor({ clinicId, initialExamples }: Props) {
  const [examples, setExamples] = useState<Example[]>(initialExamples)
  const [text, setText] = useState('')
  const [topic, setTopic] = useState('')
  const [whyGood, setWhyGood] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  async function add() {
    if (!text.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/posts/few-shot', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clinicId,
          script_text: text.trim(),
          topic: topic.trim() || undefined,
          why_good: whyGood.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      setExamples((prev) => [data.example, ...prev])
      setText('')
      setTopic('')
      setWhyGood('')
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Remove this example from the few-shot library?')) return
    try {
      const res = await fetch(`/api/posts/few-shot/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? `HTTP ${res.status}`)
      }
      setExamples((prev) => prev.filter((e) => e.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to delete')
    }
  }

  async function togglePin(id: string, pinned: boolean) {
    try {
      const res = await fetch(`/api/posts/few-shot/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pinned }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? `HTTP ${res.status}`)
      }
      setExamples((prev) =>
        prev
          .map((e) => (e.id === id ? { ...e, score: pinned ? 1000 : null } : e))
          // Re-sort: pinned (high score) first, then everything else.
          .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to update pin')
    }
  }

  return (
    <details className="rounded-lg border border-neutral-200 bg-white p-5">
      <summary className="cursor-pointer text-base font-semibold text-neutral-900">
        Few-shot examples ({examples.length})
        <span className="ml-2 text-xs font-normal text-neutral-500">
          — reference scripts the writer learns from
        </span>
      </summary>

      <div className="mt-4 flex flex-col gap-4">
        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="self-start cm-btn cm-btn-ghost text-xs"
          >
            + Add example
          </button>
        ) : (
          <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wider text-neutral-500">
                Topic (optional)
              </span>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. PRP for chronic knee pain"
                className="cm-input text-sm"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wider text-neutral-500">
                Script text *
              </span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={8}
                placeholder="Paste a real script that nailed the voice you want to clone."
                className="cm-input font-mono text-xs"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wider text-neutral-500">
                Why it works (optional)
              </span>
              <textarea
                value={whyGood}
                onChange={(e) => setWhyGood(e.target.value)}
                rows={2}
                placeholder="e.g. Hooks with a counter-intuitive stat, ends with a single clear action."
                className="cm-input text-xs"
              />
            </label>

            {error && (
              <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  setError(null)
                }}
                className="cm-btn cm-btn-ghost text-xs"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={add}
                disabled={submitting || !text.trim()}
                className="cm-btn cm-btn-primary text-xs"
              >
                {submitting ? 'Saving…' : 'Save example'}
              </button>
            </div>
          </div>
        )}

        {examples.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No examples yet. The writer will rely on auto-learned picks until you add some.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {examples.map((ex) => {
              const pinned = (ex.score ?? 0) >= 1000
              const autoScored =
                ex.score !== null && ex.score !== undefined && ex.score < 1000
              return (
                <li
                  key={ex.id}
                  className={`flex items-start gap-3 rounded-lg border p-3 ${
                    pinned
                      ? 'border-sky-200 bg-sky-50/60'
                      : 'border-neutral-200 bg-neutral-50'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {pinned && (
                        <span className="rounded-full bg-sky-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                          📌 Pinned
                        </span>
                      )}
                      {autoScored && (
                        <span className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-medium text-neutral-600">
                          Auto · {ex.score}
                        </span>
                      )}
                      {ex.topic && (
                        <p className="text-xs font-medium text-neutral-700">
                          {ex.topic}
                        </p>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-3 text-xs text-neutral-600">
                      {ex.script_text}
                    </p>
                    {ex.why_good && (
                      <p className="mt-1 text-[11px] italic text-neutral-500">
                        {ex.why_good}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={() => togglePin(ex.id, !pinned)}
                      className={`text-[11px] font-medium ${
                        pinned
                          ? 'text-sky-700 hover:text-sky-900'
                          : 'text-neutral-500 hover:text-sky-600'
                      }`}
                      title={
                        pinned
                          ? 'Remove pin — let auto-scoring rank it'
                          : 'Pin to top — keep above auto-added examples'
                      }
                    >
                      {pinned ? 'Unpin' : 'Pin'}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(ex.id)}
                      className="text-xs text-neutral-500 hover:text-red-600"
                    >
                      ×
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </details>
  )
}
