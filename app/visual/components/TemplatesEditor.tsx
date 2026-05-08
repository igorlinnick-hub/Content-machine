'use client'

import { useState } from 'react'

export type LengthBias = 'short' | 'long' | null

export interface TemplateItem {
  id: string
  name: string
  description: string | null
  scaffold: string
  length_bias: LengthBias
  position: number
  active: boolean
}

interface Props {
  clinicId: string
  initialTemplates: TemplateItem[]
}

export function TemplatesEditor({ clinicId, initialTemplates }: Props) {
  const [templates, setTemplates] = useState<TemplateItem[]>(initialTemplates)
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [scaffold, setScaffold] = useState('')
  const [lengthBias, setLengthBias] = useState<LengthBias>(null)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setName('')
    setDescription('')
    setScaffold('')
    setLengthBias(null)
    setEditingId(null)
    setError(null)
  }

  function startEdit(t: TemplateItem) {
    setOpen(true)
    setEditingId(t.id)
    setName(t.name)
    setDescription(t.description ?? '')
    setScaffold(t.scaffold)
    setLengthBias(t.length_bias)
  }

  async function save() {
    if (!name.trim() || !scaffold.trim()) {
      setError('name and scaffold are required')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      if (editingId) {
        const res = await fetch(`/api/posts/templates/${editingId}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || null,
            scaffold: scaffold.trim(),
            length_bias: lengthBias,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
        setTemplates((prev) =>
          prev.map((t) => (t.id === editingId ? (data.template as TemplateItem) : t))
        )
      } else {
        const res = await fetch('/api/posts/templates', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            clinicId,
            name: name.trim(),
            description: description.trim() || null,
            scaffold: scaffold.trim(),
            length_bias: lengthBias,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
        setTemplates((prev) => [data.template as TemplateItem, ...prev])
      }
      reset()
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this format template?')) return
    try {
      const res = await fetch(`/api/posts/templates/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? `HTTP ${res.status}`)
      }
      setTemplates((prev) => prev.filter((t) => t.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to delete')
    }
  }

  async function toggleActive(t: TemplateItem) {
    try {
      const res = await fetch(`/api/posts/templates/${t.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ active: !t.active }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      setTemplates((prev) =>
        prev.map((x) => (x.id === t.id ? (data.template as TemplateItem) : x))
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to update')
    }
  }

  return (
    <details className="rounded-lg border border-neutral-200 bg-white p-5">
      <summary className="cursor-pointer text-base font-semibold text-neutral-900">
        Format templates ({templates.length})
        <span className="ml-2 text-xs font-normal text-neutral-500">
          — structural scaffolds (system critique, patient story, etc). Different from
          golden scripts: these teach FORMAT, not topic.
        </span>
      </summary>

      <div className="mt-4 flex flex-col gap-4">
        {!open ? (
          <button
            type="button"
            onClick={() => {
              reset()
              setOpen(true)
            }}
            className="self-start cm-btn cm-btn-ghost text-xs"
          >
            + Add format template
          </button>
        ) : (
          <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wider text-neutral-500">
                Template name *
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. System critique, Diagnostic deep-dive, Patient story, Expert secrets"
                className="cm-input text-sm"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wider text-neutral-500">
                One-line description (optional)
              </span>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this format is for and when to use it"
                className="cm-input text-sm"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wider text-neutral-500">
                Length bias
              </span>
              <select
                value={lengthBias ?? ''}
                onChange={(e) =>
                  setLengthBias((e.target.value || null) as LengthBias)
                }
                className="cm-input text-sm"
              >
                <option value="">Both (no bias)</option>
                <option value="short">Short — 60-90s boost cut</option>
                <option value="long">Long — 2-3min organic</option>
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wider text-neutral-500">
                Scaffold (the format itself) *
              </span>
              <textarea
                value={scaffold}
                onChange={(e) => setScaffold(e.target.value)}
                rows={14}
                placeholder={`Paste the structural template — beats / sections / placeholders in [BRACKETS].\nE.g.\n[Hook line — surprising stat or contradiction]\n[Body 1 — what most people think]\n[Body 2 — what's actually true]\n[Body 3 — what changes if you act on it]\n[CTA — one specific action]`}
                className="cm-input font-mono text-xs"
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
                  reset()
                  setOpen(false)
                }}
                className="cm-btn cm-btn-ghost text-xs"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={submitting || !name.trim() || !scaffold.trim()}
                className="cm-btn cm-btn-primary text-xs"
              >
                {submitting ? 'Saving…' : editingId ? 'Update template' : 'Save template'}
              </button>
            </div>
          </div>
        )}

        {templates.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No format templates yet. Paste 6-10 structural scaffolds — the writer will pick
            one per variant so posts stay structurally diverse.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {templates.map((t) => (
              <li
                key={t.id}
                className={`flex items-start gap-3 rounded-lg border p-3 ${
                  t.active
                    ? 'border-neutral-200 bg-neutral-50'
                    : 'border-dashed border-neutral-200 bg-neutral-50/40 opacity-60'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-neutral-900">{t.name}</p>
                    {t.length_bias && (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-sky-700">
                        {t.length_bias}
                      </span>
                    )}
                    {!t.active && (
                      <span className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-medium text-neutral-500">
                        inactive
                      </span>
                    )}
                  </div>
                  {t.description && (
                    <p className="mt-1 text-xs text-neutral-600">{t.description}</p>
                  )}
                  <pre className="mt-2 line-clamp-4 whitespace-pre-wrap break-words text-[11px] text-neutral-500">
                    {t.scaffold}
                  </pre>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <button
                    type="button"
                    onClick={() => startEdit(t)}
                    className="text-[11px] font-medium text-neutral-600 hover:text-sky-700"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleActive(t)}
                    className="text-[11px] font-medium text-neutral-500 hover:text-sky-700"
                  >
                    {t.active ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(t.id)}
                    className="text-xs text-neutral-500 hover:text-red-600"
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  )
}
