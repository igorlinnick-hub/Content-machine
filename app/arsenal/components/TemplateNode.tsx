'use client'

import { useState } from 'react'
import type { TemplateWithSource } from './TemplatesCanvas'

interface TemplateNodeProps {
  item: TemplateWithSource
  clinicId: string
  onToggle: () => void
  onDelete: () => void
}

// One whiteboard node per script_template. Top half: source reference
// video preview when this template came from an arsenal entry (so the
// admin sees the example it's mimicking). Bottom half: the scaffold
// itself, collapsible. Footer: active toggle + meta.

export function TemplateNode({
  item,
  clinicId,
  onToggle,
  onDelete,
}: TemplateNodeProps) {
  void clinicId
  const [open, setOpen] = useState(false)
  const { template, source_video_url, source_thumbnail_url, source_arsenal_id } =
    item
  const isArsenal = template.name.startsWith('arsenal:')
  const displayName = isArsenal
    ? template.name.slice('arsenal:'.length)
    : template.name

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
            <h3 className="truncate font-mono text-sm font-semibold text-neutral-900">
              {displayName}
            </h3>
          </div>
          {template.description && (
            <p className="mt-0.5 line-clamp-2 text-[11px] text-neutral-500">
              {template.description}
            </p>
          )}
        </div>
        <button
          onClick={onToggle}
          className={`flex-shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition ${
            template.active
              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
              : 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300'
          }`}
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

      {/* Scaffold — collapsed by default */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center justify-between rounded text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500 hover:text-neutral-700"
        >
          <span>Scaffold ({scaffoldBeatCount(template.scaffold)} beats)</span>
          <span>{open ? '▴' : '▾'}</span>
        </button>
        {open && (
          <pre className="whitespace-pre-wrap rounded border border-neutral-200 bg-neutral-50 p-2 font-mono text-[11px] leading-snug text-neutral-800">
            {template.scaffold}
          </pre>
        )}
        <footer className="mt-auto flex items-center justify-between gap-2 pt-1 text-[11px] text-neutral-500">
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
        </footer>
        {source_arsenal_id && (
          <a
            href={`/arsenal?tab=arsenal#${source_arsenal_id}`}
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
