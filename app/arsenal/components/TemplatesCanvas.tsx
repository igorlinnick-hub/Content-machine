'use client'

import { useState } from 'react'
import type { ScriptTemplate } from '@/lib/posts/templates'
import { TemplateNode } from './TemplateNode'
import { NewTemplateForm } from './NewTemplateForm'

export interface TemplateWithSource {
  template: ScriptTemplate
  source_arsenal_id: string | null
  source_video_url: string | null
  source_thumbnail_url: string | null
  source_style_description: string | null
}

interface TemplatesCanvasProps {
  clinicId: string
  initialTemplates: TemplateWithSource[]
}

// Whiteboard-style view of all per-clinic script templates. Each
// template is a card-node showing the reference video preview (when
// the template was derived from an arsenal entry), the scaffold
// itself, and a toggle to flip it in/out of Writer's rotation. The
// bot chain visualisation below makes it concrete: ACTIVE templates
// → Marek (Writer) → Critic → Splitter → Renderer → Slide Set. The
// goal is at-a-glance "what is the writer drawing from right now".
//
// Static layout for now (no drag-drop) — clinics have 5-15
// templates max, so a grid + ordering by position is enough. If we
// ever need branching (template → different writers, AB tests),
// pull in react-flow at that point.

export function TemplatesCanvas({
  clinicId,
  initialTemplates,
}: TemplatesCanvasProps) {
  const [items, setItems] = useState(initialTemplates)

  function patchOne(id: string, patch: Partial<ScriptTemplate>): void {
    setItems((cur) =>
      cur.map((it) =>
        it.template.id === id
          ? { ...it, template: { ...it.template, ...patch } }
          : it
      )
    )
  }
  function dropOne(id: string): void {
    setItems((cur) => cur.filter((it) => it.template.id !== id))
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

  const active = items.filter((i) => i.template.active)
  const off = items.filter((i) => !i.template.active)

  function addOne(template: ScriptTemplate): void {
    setItems((cur) => [
      {
        template,
        source_arsenal_id: null,
        source_video_url: null,
        source_thumbnail_url: null,
        source_style_description: null,
      },
      ...cur,
    ])
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Intro */}
      <p className="rounded border border-violet-200 bg-violet-50/60 p-3 text-xs text-violet-700">
        These are the structural scaffolds <strong>Marek (Writer)</strong> picks
        from on every script generation. Each card is one scaffold —{' '}
        <em>arsenal-derived</em> cards carry the source video preview so you can
        see the pattern they teach. Toggle off what should stop influencing
        Writer; that decision applies on the next generation immediately.
      </p>

      {/* Manual template creator — third path next to seed defaults +
          arsenal-derived. Inline form above the grid. */}
      <NewTemplateForm clinicId={clinicId} onCreated={addOne} />

      {/* Active templates grid */}
      <section className="flex flex-col gap-3">
        <header className="flex items-baseline justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-600">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
            Active ({active.length})
          </h2>
          <p className="text-xs text-neutral-500">
            Writer sees all active scaffolds in its brief.
          </p>
        </header>

        {active.length === 0 ? (
          <p className="rounded border border-dashed border-neutral-300 p-4 text-sm text-neutral-500">
            No active templates — Writer falls back to its base prompt. Confirm
            an arsenal entry or seed defaults to populate this list.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((it) => (
              <TemplateNode
                key={it.template.id}
                item={it}
                clinicId={clinicId}
                onToggle={() => void toggle(it.template.id, false)}
                onDelete={() =>
                  void remove(it.template.id, it.template.name)
                }
                onPatch={(patch) => patchOne(it.template.id, patch)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Off templates */}
      {off.length > 0 && (
        <section className="flex flex-col gap-3">
          <header className="flex items-baseline justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-600">
              <span className="inline-block h-2 w-2 rounded-full bg-neutral-300" />
              Off ({off.length})
            </h2>
            <p className="text-xs text-neutral-500">
              In storage; Writer ignores these.
            </p>
          </header>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {off.map((it) => (
              <TemplateNode
                key={it.template.id}
                item={it}
                clinicId={clinicId}
                onToggle={() => void toggle(it.template.id, true)}
                onDelete={() =>
                  void remove(it.template.id, it.template.name)
                }
                onPatch={(patch) => patchOne(it.template.id, patch)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
