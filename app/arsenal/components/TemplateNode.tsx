'use client'

import { useState } from 'react'
import type { ScriptTemplate, ScriptTemplateLengthBias } from '@/lib/posts/templates'
import type { TemplateWithSource } from './TemplatesCanvas'

interface TemplateNodeProps {
  item: TemplateWithSource
  clinicId: string
  onToggle: () => void
  onDelete: () => void
  onPatch: (patch: Partial<ScriptTemplate>) => void
}

// One whiteboard node per script_template. Top half: source reference
// video preview when this template came from an arsenal entry (so the
// admin sees the example it's mimicking). Bottom half: the scaffold,
// always visible. Click Edit → name + scaffold + length_bias become
// editable inline; Save calls PATCH /api/posts/templates/[id] which
// writes through to the same row the Writer reads from on the next
// generation (loadSharedContext re-selects active=true on each call).

const LENGTH_OPTIONS: Array<{ label: string; value: ScriptTemplateLengthBias | null }> = [
  { label: 'short / long', value: null },
  { label: 'short only', value: 'short' },
  { label: 'long only', value: 'long' },
]

export function TemplateNode({
  item,
  clinicId,
  onToggle,
  onDelete,
  onPatch,
}: TemplateNodeProps) {
  void clinicId
  const { template, source_video_url, source_thumbnail_url, source_arsenal_id } =
    item
  const isArsenal = template.name.startsWith('arsenal:')
  const displayName = isArsenal
    ? template.name.slice('arsenal:'.length)
    : template.name

  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [draftName, setDraftName] = useState(displayName)
  const [draftScaffold, setDraftScaffold] = useState(template.scaffold)
  const [draftLengthBias, setDraftLengthBias] = useState<
    ScriptTemplateLengthBias | null
  >(template.length_bias)

  function cancelEdit(): void {
    setDraftName(displayName)
    setDraftScaffold(template.scaffold)
    setDraftLengthBias(template.length_bias)
    setEditing(false)
    setErr(null)
  }

  async function save(): Promise<void> {
    setBusy(true)
    setErr(null)
    try {
      // Preserve the "arsenal:" prefix automatically — admin only
      // edits the human-readable part so the link back to the source
      // arsenal row keeps working.
      const finalName = isArsenal ? `arsenal:${draftName.trim()}` : draftName.trim()
      const res = await fetch(`/api/posts/templates/${template.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: finalName,
          scaffold: draftScaffold,
          length_bias: draftLengthBias,
        }),
      })
      const payload = (await res.json()) as {
        template?: ScriptTemplate
        error?: string
      }
      if (!res.ok || !payload.template) {
        setErr(payload.error ?? `save failed (${res.status})`)
        return
      }
      onPatch(payload.template)
      setEditing(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'network error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <article
      className={`relative flex flex-col overflow-hidden rounded-xl border-2 bg-white shadow-sm transition ${
        template.active
          ? 'border-emerald-200 hover:border-emerald-300'
          : 'border-neutral-200 opacity-70 hover:opacity-100'
      }`}
    >
      {/* Header strip */}
      <div className="flex items-center justify-between gap-2 border-b border-neutral-100 bg-neutral-50/60 px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${
                template.active ? 'bg-emerald-400' : 'bg-neutral-300'
              }`}
            />
            {editing && !isArsenal ? (
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                className="cm-input w-full px-1 py-0.5 font-mono text-sm font-semibold"
                disabled={busy}
              />
            ) : editing && isArsenal ? (
              <>
                <span className="font-mono text-sm text-neutral-400">
                  arsenal:
                </span>
                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="cm-input w-full px-1 py-0.5 font-mono text-sm font-semibold"
                  disabled={busy}
                />
              </>
            ) : (
              <h3 className="truncate font-mono text-sm font-semibold text-neutral-900">
                {displayName}
              </h3>
            )}
          </div>
          {template.description && !editing && (
            <p className="mt-0.5 line-clamp-2 text-[11px] text-neutral-500">
              {template.description}
            </p>
          )}
        </div>
        <button
          onClick={onToggle}
          disabled={editing || busy}
          className={`flex-shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition ${
            template.active
              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
              : 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300'
          } disabled:opacity-50`}
        >
          {template.active ? 'On' : 'Off'}
        </button>
      </div>

      {/* Preview — source video or arsenal-derived badge */}
      {source_video_url ? (
        <div className="relative aspect-[9/16] w-full bg-black sm:aspect-video">
          <video
            src={source_video_url}
            poster={source_thumbnail_url ?? undefined}
            className="h-full w-full object-cover"
            controls
            playsInline
            preload="none"
          />
          <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
            🧱 from arsenal
          </span>
        </div>
      ) : isArsenal ? (
        <div className="flex aspect-video w-full items-center justify-center bg-violet-50 text-center text-xs text-violet-700">
          <span>
            🧱 from arsenal{' '}
            <em className="opacity-60">(no video uploaded yet)</em>
          </span>
        </div>
      ) : (
        <div className="flex aspect-video w-full items-center justify-center bg-neutral-50 text-center text-xs text-neutral-400">
          📋 Seed scaffold (no source video)
        </div>
      )}

      {/* Scaffold — always visible. Edit toggles a textarea in place. */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          <span>Scaffold ({scaffoldBeatCount(template.scaffold)} beats)</span>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="rounded text-violet-600 hover:underline"
            >
              ✏️ Edit
            </button>
          )}
        </div>

        {editing ? (
          <textarea
            value={draftScaffold}
            onChange={(e) => setDraftScaffold(e.target.value)}
            className="min-h-[180px] resize-y rounded border border-violet-200 bg-white p-2 font-mono text-[12px] leading-snug text-neutral-900 focus:border-violet-400 focus:outline-none"
            disabled={busy}
          />
        ) : (
          <pre className="max-h-[200px] overflow-y-auto whitespace-pre-wrap rounded border border-neutral-200 bg-neutral-50 p-2 font-mono text-[11px] leading-snug text-neutral-800">
            {template.scaffold}
          </pre>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-neutral-500">
          {editing ? (
            <>
              <select
                value={draftLengthBias ?? ''}
                onChange={(e) =>
                  setDraftLengthBias(
                    (e.target.value || null) as ScriptTemplateLengthBias | null
                  )
                }
                disabled={busy}
                className="cm-input rounded border border-neutral-200 bg-white px-2 py-1 text-[11px]"
              >
                {LENGTH_OPTIONS.map((o) => (
                  <option key={o.label} value={o.value ?? ''}>
                    {o.label}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1">
                <button
                  onClick={cancelEdit}
                  disabled={busy}
                  className="rounded px-2 py-1 text-neutral-500 hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void save()}
                  disabled={busy}
                  className="rounded bg-violet-500 px-2 py-1 font-semibold text-white hover:bg-violet-600 disabled:opacity-60"
                >
                  {busy ? 'Saving…' : 'Save'}
                </button>
              </div>
            </>
          ) : (
            <>
              <span>
                {template.length_bias ? (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-700">
                    {template.length_bias}
                  </span>
                ) : (
                  'short / long'
                )}
              </span>
              <button
                onClick={onDelete}
                className="rounded text-rose-600 hover:underline"
              >
                Delete
              </button>
            </>
          )}
        </footer>

        {err && <p className="text-[11px] text-rose-600">{err}</p>}

        {source_arsenal_id && !editing && (
          <a
            href={`/arsenal#${source_arsenal_id}`}
            className="text-[11px] text-violet-600 hover:underline"
          >
            ↗ open source in Arsenal
          </a>
        )}
      </div>
    </article>
  )
}

function scaffoldBeatCount(scaffold: string): number {
  return (scaffold.match(/\[/g) ?? []).length
}
