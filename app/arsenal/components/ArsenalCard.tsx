'use client'

import { useState } from 'react'
import type {
  ArsenalRefineEntry,
  ArsenalStoryboardFrame,
  ArsenalVisualNotes,
} from '@/lib/arsenal/store'
import type { DecoratedArsenalRow } from './types'
import { RefineChat } from './RefineChat'

interface ArsenalCardProps {
  row: DecoratedArsenalRow
  clinicId: string
  onPatch: (id: string, patch: Partial<DecoratedArsenalRow>) => void
  onDrop: (id: string) => void
}

// Compact-by-default card: just thumbnail + label + hook count + actions.
// Click "Open" to expand into the full video player + extraction details.
// Keeps the list scannable when there are dozens of entries.

export function ArsenalCard({ row, clinicId, onPatch, onDrop }: ArsenalCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [tplMsg, setTplMsg] = useState<string | null>(null)

  async function action(
    body: { action: 'confirm' | 'on' | 'off' | 'delete' },
    label: string
  ): Promise<void> {
    setBusy(label)
    setErr(null)
    try {
      const res = await fetch(`/api/arsenal/${row.id}/toggle`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...body, clinicId }),
      })
      const payload = (await res.json()) as {
        ok?: boolean
        row?: DecoratedArsenalRow
        error?: string
      }
      if (!res.ok || !payload.ok) {
        setErr(payload.error ?? `request failed (${res.status})`)
        return
      }
      if (body.action === 'delete') {
        onDrop(row.id)
      } else if (payload.row) {
        onPatch(row.id, payload.row)
      }
    } catch (e) {
      const m = e instanceof Error ? e.message : 'network error'
      setErr(m)
    } finally {
      setBusy(null)
    }
  }

  async function saveAsTemplate(): Promise<void> {
    setBusy('save')
    setErr(null)
    setTplMsg(null)
    try {
      const res = await fetch(`/api/arsenal/${row.id}/save-as-template`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clinicId }),
      })
      const payload = (await res.json()) as {
        ok?: boolean
        template?: { id: string; name: string }
        error?: string
      }
      if (!res.ok || !payload.ok) {
        setErr(payload.error ?? `request failed (${res.status})`)
        return
      }
      setTplMsg(`Saved as "${payload.template?.name ?? '?'}"`)
    } catch (e) {
      const m = e instanceof Error ? e.message : 'network error'
      setErr(m)
    } finally {
      setBusy(null)
    }
  }

  const hooks = Array.isArray(row.hooks) ? row.hooks : []
  const beats = row.structure?.beats ?? []
  const pains = Array.isArray(row.pains) ? row.pains : []
  const visual: ArsenalVisualNotes = row.visual_notes ?? {}
  const hasVisual = Boolean(
    visual.storyboard?.length || visual.pacing || visual.broll_pattern
  )
  const refineHistory: ArsenalRefineEntry[] = Array.isArray(row.refine_history)
    ? row.refine_history
    : []

  const statusChip = row.is_active
    ? { text: 'active', cls: 'bg-emerald-100 text-emerald-700' }
    : row.confirmed_at
      ? { text: 'off', cls: 'bg-neutral-100 text-neutral-600' }
      : { text: 'awaiting confirm', cls: 'bg-amber-100 text-amber-700' }

  return (
    <article className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      {/* Collapsed header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-neutral-50"
      >
        <div className="h-16 w-12 flex-shrink-0 overflow-hidden rounded bg-neutral-100">
          {row.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={row.thumbnail_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-400">
              {row.source_platform ?? '?'}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-mono text-sm font-semibold text-neutral-900">
              {row.style_label}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusChip.cls}`}
            >
              {statusChip.text}
            </span>
          </div>
          {row.style_description && (
            <p className="mt-0.5 truncate text-xs text-neutral-600">
              {row.style_description}
            </p>
          )}
          <p className="mt-0.5 text-[11px] text-neutral-500">
            {hooks.length} hook{hooks.length === 1 ? '' : 's'}
            {' · '}
            {beats.length} beat{beats.length === 1 ? '' : 's'}
            {hasVisual ? ' · visual ✓' : ''}
            {refineHistory.length > 0 ? ` · ${refineHistory.length} refines` : ''}
          </p>
        </div>
        <span className="text-xs text-neutral-400">{expanded ? '▴' : '▾'}</span>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-neutral-200 p-4">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="w-full md:w-2/5">
              {row.video_url ? (
                <video
                  src={row.video_url}
                  controls
                  playsInline
                  poster={row.thumbnail_url ?? undefined}
                  className="w-full rounded-md bg-black"
                  style={{ aspectRatio: '9/16' }}
                />
              ) : (
                <a
                  href={row.source_url ?? '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="flex aspect-[9/16] w-full items-center justify-center rounded-md bg-neutral-100 text-xs text-neutral-500 hover:bg-neutral-200"
                >
                  {row.source_platform ?? 'video'} — open source ↗
                </a>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-3 text-sm text-neutral-700">
              {hooks.length > 0 && (
                <section>
                  <h4 className="text-xs font-semibold uppercase text-neutral-500">
                    Hooks
                  </h4>
                  <ol className="mt-1 list-decimal space-y-1 pl-5">
                    {hooks.map((h, i) => (
                      <li key={i}>
                        <span className="italic">&ldquo;{h.text}&rdquo;</span>
                        {h.why_it_works && (
                          <span className="ml-1 text-xs text-neutral-500">
                            — {h.why_it_works}
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {beats.length > 0 && (
                <section>
                  <h4 className="text-xs font-semibold uppercase text-neutral-500">
                    Structure
                  </h4>
                  <ul className="mt-1 space-y-0.5">
                    {beats.map((b, i) => (
                      <li key={i}>
                        <span className="font-semibold">{b.name}</span> — {b.text}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {hasVisual && (
                <section>
                  <h4 className="text-xs font-semibold uppercase text-neutral-500">
                    Visual &amp; b-roll
                  </h4>
                  <div className="mt-1 space-y-1">
                    {visual.pacing && (
                      <p>
                        <span className="text-[11px] uppercase text-neutral-400">
                          Pacing
                        </span>{' '}
                        — {visual.pacing}
                      </p>
                    )}
                    {visual.hook_visual && (
                      <p>
                        <span className="text-[11px] uppercase text-neutral-400">
                          Hook visual
                        </span>{' '}
                        — {visual.hook_visual}
                      </p>
                    )}
                    {visual.broll_pattern && (
                      <p>
                        <span className="text-[11px] uppercase text-neutral-400">
                          B-roll pattern
                        </span>{' '}
                        — {visual.broll_pattern}
                      </p>
                    )}
                    {visual.storyboard && visual.storyboard.length > 0 && (
                      <Storyboard frames={visual.storyboard} />
                    )}
                  </div>
                </section>
              )}

              {pains.length > 0 && (
                <p>
                  <span className="text-[11px] uppercase text-neutral-400">
                    Pains
                  </span>{' '}
                  — {pains.slice(0, 6).join(' · ')}
                </p>
              )}

              {row.tags.length > 0 && (
                <p className="text-xs text-neutral-500">
                  {row.tags.map((t) => `#${t}`).join(' ')}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-neutral-200 pt-3">
            {!row.confirmed_at && (
              <button
                onClick={() => action({ action: 'confirm' }, 'confirm')}
                disabled={busy !== null}
                className="cm-btn cm-btn-primary text-xs"
              >
                {busy === 'confirm' ? 'Confirming…' : 'Confirm & add to templates'}
              </button>
            )}
            {row.confirmed_at && (
              <button
                onClick={() =>
                  action(
                    { action: row.is_active ? 'off' : 'on' },
                    row.is_active ? 'off' : 'on'
                  )
                }
                disabled={busy !== null}
                className="cm-btn cm-btn-ghost text-xs"
              >
                {busy === 'on' || busy === 'off'
                  ? '…'
                  : row.is_active
                    ? 'Turn off'
                    : 'Turn on'}
              </button>
            )}
            <button
              onClick={saveAsTemplate}
              disabled={busy !== null}
              className="cm-btn cm-btn-ghost text-xs"
            >
              {busy === 'save' ? 'Saving…' : 'Re-save as template'}
            </button>
            <div className="ml-auto flex items-center gap-2">
              <RefineToggleNote pending={row.pending_refine_note} />
              <button
                onClick={() => {
                  if (confirm(`Delete "${row.style_label}" permanently?`)) {
                    void action({ action: 'delete' }, 'delete')
                  }
                }}
                disabled={busy !== null}
                className="cm-btn cm-btn-ghost text-xs text-rose-600 hover:bg-rose-50"
              >
                {busy === 'delete' ? '…' : 'Drop'}
              </button>
            </div>
          </div>

          {tplMsg && <p className="mt-2 text-xs text-emerald-600">{tplMsg}</p>}
          {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}

          <div className="mt-4 border-t border-neutral-200 pt-3">
            <RefineChat
              arsenalId={row.id}
              clinicId={clinicId}
              pendingNote={row.pending_refine_note}
              onUpdated={(patch) => onPatch(row.id, patch)}
            />
            {refineHistory.length > 0 && (
              <details className="mt-3 text-xs">
                <summary className="cursor-pointer text-neutral-600">
                  Refinement history ({refineHistory.length})
                </summary>
                <ul className="mt-2 space-y-1">
                  {refineHistory.slice(0, 8).map((h, i) => (
                    <li key={i} className="text-neutral-600">
                      <span className="text-neutral-400">
                        {new Date(h.at).toLocaleString()}
                      </span>{' '}
                      — &ldquo;{h.note}&rdquo;
                      {h.summary && (
                        <span className="ml-1 text-neutral-500">
                          — {h.summary}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </div>
      )}
    </article>
  )
}

function RefineToggleNote({ pending }: { pending: string | null }) {
  if (!pending) return null
  return (
    <span className="text-[11px] italic text-amber-600">
      refining: &ldquo;{pending.slice(0, 30)}
      {pending.length > 30 ? '…' : ''}&rdquo;
    </span>
  )
}

function Storyboard({ frames }: { frames: ArsenalStoryboardFrame[] }) {
  return (
    <div className="grid grid-cols-1 gap-1 text-xs text-neutral-600 sm:grid-cols-2">
      {frames.slice(0, 12).map((f, i) => (
        <div key={i} className="rounded border border-neutral-200 bg-white p-2">
          <span className="text-neutral-400">
            {typeof f.sec === 'number' ? `${f.sec.toFixed(1)}s` : `#${i + 1}`}
          </span>{' '}
          {f.description}
          {f.broll_type && (
            <span className="ml-1 rounded bg-neutral-100 px-1 text-[10px] uppercase">
              {f.broll_type}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
