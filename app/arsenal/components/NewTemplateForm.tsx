'use client'

import { useState } from 'react'
import type {
  ScriptTemplate,
  ScriptTemplateLengthBias,
} from '@/lib/posts/templates'

interface NewTemplateFormProps {
  clinicId: string
  onCreated: (template: ScriptTemplate) => void
}

const SCAFFOLD_PLACEHOLDER = `[Hook — one-sentence opener that contradicts a common belief.]
[Mechanism — two sentences explaining how the treatment works.]
[Proof — one anonymised patient outcome.]
[CTA — specific next step, not "book now".]`

// Manual template entry — third creation path next to (1) seeded
// defaults and (2) arsenal confirm. Posts to /api/posts/templates
// which inserts active=true; the new row appears immediately in
// the canvas via onCreated, and Writer reads it on the next
// generation (loadSharedContext re-selects on every call).

export function NewTemplateForm({ clinicId, onCreated }: NewTemplateFormProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [scaffold, setScaffold] = useState('')
  const [lengthBias, setLengthBias] = useState<ScriptTemplateLengthBias | null>(
    null
  )
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function reset(): void {
    setName('')
    setDescription('')
    setScaffold('')
    setLengthBias(null)
    setErr(null)
  }

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!name.trim() || !scaffold.trim()) {
      setErr('Name and scaffold are required.')
      return
    }
    setBusy(true)
    setErr(null)
    try {
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
      const payload = (await res.json()) as {
        template?: ScriptTemplate
        error?: string
      }
      if (!res.ok || !payload.template) {
        setErr(payload.error ?? `request failed (${res.status})`)
        return
      }
      onCreated(payload.template)
      reset()
      setOpen(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'network error')
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="self-start rounded-lg border border-dashed border-violet-300 bg-violet-50/40 px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100"
      >
        + New template (manual)
      </button>
    )
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-xl border-2 border-violet-200 bg-violet-50/30 p-4"
    >
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-violet-900">
          New template (manual)
        </h3>
        <button
          type="button"
          onClick={() => {
            reset()
            setOpen(false)
          }}
          className="text-[11px] text-neutral-500 hover:underline"
          disabled={busy}
        >
          Cancel
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-neutral-700">Name *</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Counter-intuitive opener"
            className="cm-input font-mono text-sm"
            disabled={busy}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-neutral-700">Length bias</span>
          <select
            value={lengthBias ?? ''}
            onChange={(e) =>
              setLengthBias(
                (e.target.value || null) as ScriptTemplateLengthBias | null
              )
            }
            disabled={busy}
            className="cm-input text-sm"
          >
            <option value="">short / long (either)</option>
            <option value="short">short only</option>
            <option value="long">long only</option>
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-neutral-700">Description</span>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="One-liner the writer sees alongside the scaffold."
          className="cm-input text-sm"
          disabled={busy}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-neutral-700">
          Scaffold * — use [Bracketed] beats
        </span>
        <textarea
          value={scaffold}
          onChange={(e) => setScaffold(e.target.value)}
          placeholder={SCAFFOLD_PLACEHOLDER}
          className="cm-input min-h-[160px] resize-y font-mono text-[12px] leading-snug"
          disabled={busy}
          required
        />
      </label>

      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-neutral-500">
          Saved as <span className="font-semibold text-emerald-700">active</span>{' '}
          — Writer picks it up on the next generation.
        </p>
        <button
          type="submit"
          disabled={busy || !name.trim() || !scaffold.trim()}
          className="cm-btn cm-btn-primary text-sm"
        >
          {busy ? 'Saving…' : 'Create template'}
        </button>
      </div>

      {err && <p className="text-[11px] text-rose-600">{err}</p>}
    </form>
  )
}
