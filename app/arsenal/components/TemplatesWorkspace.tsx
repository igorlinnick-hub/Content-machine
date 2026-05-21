'use client'

import { useState } from 'react'
import type { ScriptTemplate } from '@/lib/posts/templates'

interface TemplatesWorkspaceProps {
  clinicId: string
  initialTemplates: ScriptTemplate[]
}

export function TemplatesWorkspace({
  clinicId,
  initialTemplates,
}: TemplatesWorkspaceProps) {
  const [templates, setTemplates] = useState(initialTemplates)

  function patchOne(id: string, patch: Partial<ScriptTemplate>): void {
    setTemplates((current) =>
      current.map((t) => (t.id === id ? { ...t, ...patch } : t))
    )
  }
  function dropOne(id: string): void {
    setTemplates((current) => current.filter((t) => t.id !== id))
  }

  async function toggle(id: string, next: boolean): Promise<void> {
    const res = await fetch(`/api/posts/templates/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ active: next }),
    })
    const payload = (await res.json()) as { template?: ScriptTemplate }
    if (payload.template) patchOne(id, payload.template)
  }
  async function remove(id: string, name: string): Promise<void> {
    if (!confirm(`Delete template "${name}"?`)) return
    const res = await fetch(`/api/posts/templates/${id}`, { method: 'DELETE' })
    if (res.ok) dropOne(id)
  }

  const active = templates.filter((t) => t.active)
  const off = templates.filter((t) => !t.active)

  return (
    <div className="flex flex-col gap-6">
      <p className="rounded border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600">
        Templates are the structural scaffolds Marek picks from on every
        generation. The 6 defaults are seeded the first time you create a post;
        new entries come either from{' '}
        <em>Save as template</em> on an arsenal entry, or from a direct add via
        the API. Turn off what you don&apos;t want the writer using right now.
      </p>

      <Section title={`Active (${active.length})`}>
        {active.map((t) => (
          <TemplateRow
            key={t.id}
            template={t}
            onToggle={() => void toggle(t.id, false)}
            onDelete={() => void remove(t.id, t.name)}
            clinicId={clinicId}
          />
        ))}
      </Section>

      {off.length > 0 && (
        <Section title={`Off (${off.length})`}>
          {off.map((t) => (
            <TemplateRow
              key={t.id}
              template={t}
              onToggle={() => void toggle(t.id, true)}
              onDelete={() => void remove(t.id, t.name)}
              clinicId={clinicId}
            />
          ))}
        </Section>
      )}
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
        {title}
      </h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  )
}

function TemplateRow({
  template,
  onToggle,
  onDelete,
  clinicId,
}: {
  template: ScriptTemplate
  onToggle: () => void
  onDelete: () => void
  clinicId: string
}) {
  const [expanded, setExpanded] = useState(false)
  // clinicId is not yet used here (edit flow lives in a future iteration) —
  // accept it so the parent can pass without prop-drilling later.
  void clinicId
  return (
    <article className="rounded border border-neutral-200 bg-white p-3">
      <header className="flex items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">
            {template.name}
          </h3>
          {template.description && (
            <p className="text-xs text-neutral-600">{template.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              template.active
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-neutral-100 text-neutral-600'
            }`}
          >
            {template.active ? 'active' : 'off'}
          </span>
          <button onClick={onToggle} className="cm-btn cm-btn-ghost text-xs">
            {template.active ? 'Turn off' : 'Turn on'}
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="cm-btn cm-btn-ghost text-xs"
          >
            {expanded ? 'Hide scaffold' : 'Show scaffold'}
          </button>
          <button
            onClick={onDelete}
            className="cm-btn cm-btn-ghost text-xs text-rose-600 hover:bg-rose-50"
          >
            Delete
          </button>
        </div>
      </header>
      {expanded && (
        <pre className="mt-3 whitespace-pre-wrap rounded border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-800">
          {template.scaffold}
        </pre>
      )}
    </article>
  )
}
