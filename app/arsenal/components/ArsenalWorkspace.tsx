'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { QueueRow } from '@/lib/arsenal/store'
import { ArsenalCard } from './ArsenalCard'
import { IngestUrlForm } from './IngestUrlForm'
import type { DecoratedArsenalRow } from './types'

interface ArsenalWorkspaceProps {
  clinicId: string
  initialRows: DecoratedArsenalRow[]
  initialQueue: QueueRow[]
}

function queueIcon(status: string): string {
  if (status === 'processing') return '🌀'
  if (status === 'failed') return '🔴'
  return '🕐'
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url)
    const tail = u.pathname.replace(/\/$/, '').split('/').pop() ?? ''
    return `${u.hostname}/…/${tail}`
  } catch {
    return url.slice(0, 60)
  }
}

export function ArsenalWorkspace({
  clinicId,
  initialRows,
  initialQueue,
}: ArsenalWorkspaceProps) {
  const router = useRouter()
  const [rows, setRows] = useState(initialRows)
  const [queue, setQueue] = useState(initialQueue)
  const [showIngest, setShowIngest] = useState(false)

  function patchRow(id: string, patch: Partial<DecoratedArsenalRow>): void {
    setRows((current) =>
      current.map((r) => (r.id === id ? { ...r, ...patch } : r))
    )
  }
  function dropRow(id: string): void {
    setRows((current) => current.filter((r) => r.id !== id))
  }

  const active = rows.filter((r) => r.is_active)
  const drafts = rows.filter(
    (r) => !r.is_active && r.confirmed_at === null
  )
  const off = rows.filter((r) => !r.is_active && r.confirmed_at !== null)

  return (
    <div className="flex flex-col gap-6">
      {/* Compact trigger — opens modal */}
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setShowIngest(true)}
          className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white/80 px-4 py-2 text-[13px] font-medium text-neutral-600 shadow-sm transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add reference video
        </button>
      </div>

      {/* Modal */}
      {showIngest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowIngest(false) }}
        >
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
              <p className="text-sm font-semibold text-neutral-800">Add reference video</p>
              <button
                type="button"
                onClick={() => setShowIngest(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5">
              <IngestUrlForm
                clinicId={clinicId}
                onQueued={(row) => {
                  setQueue((current) => [row, ...current])
                  setShowIngest(false)
                  router.refresh()
                }}
              />
            </div>
          </div>
        </div>
      )}

      {queue.length > 0 && (
        <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <h2 className="text-sm font-semibold text-neutral-700">
            In queue ({queue.length})
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            The local skill processes these. Run{' '}
            <span className="rounded bg-neutral-200 px-1 py-0.5 font-mono text-[11px]">
              script-arsenal-ingest
            </span>{' '}
            in Claude Code on your machine to pull them.
          </p>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {queue.map((q) => (
              <li
                key={q.id}
                className="flex flex-col gap-1 rounded border border-neutral-200 bg-white px-3 py-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-neutral-700">
                    {queueIcon(q.status)} {shortUrl(q.source_url)}
                  </span>
                  <div className="flex items-center gap-2">
                    {q.intent === 'template_for_clinic' && (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700">
                        🧱 clinic template
                      </span>
                    )}
                    <span className="text-xs text-neutral-500">{q.status}</span>
                  </div>
                </div>
                {q.user_context && (
                  <p className="truncate text-xs italic text-neutral-500">
                    “{q.user_context}”
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {drafts.length > 0 && (
        <Section title={`Awaiting confirm (${drafts.length})`} accent="amber">
          {drafts.map((r) => (
            <ArsenalCard
              key={r.id}
              row={r}
              clinicId={clinicId}
              onPatch={patchRow}
              onDrop={dropRow}
            />
          ))}
        </Section>
      )}

      {active.length > 0 && (
        <Section title={`Active styles (${active.length})`} accent="emerald">
          {active.map((r) => (
            <ArsenalCard
              key={r.id}
              row={r}
              clinicId={clinicId}
              onPatch={patchRow}
              onDrop={dropRow}
            />
          ))}
        </Section>
      )}

      {off.length > 0 && (
        <Section title={`Off (${off.length})`} accent="neutral">
          {off.map((r) => (
            <ArsenalCard
              key={r.id}
              row={r}
              clinicId={clinicId}
              onPatch={patchRow}
              onDrop={dropRow}
            />
          ))}
        </Section>
      )}
    </div>
  )
}

function Section({
  title,
  accent,
  children,
}: {
  title: string
  accent: 'emerald' | 'amber' | 'neutral'
  children: React.ReactNode
}) {
  const dot =
    accent === 'emerald'
      ? 'bg-emerald-400'
      : accent === 'amber'
        ? 'bg-amber-400'
        : 'bg-neutral-300'
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-600">
        <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
        {title}
      </h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}
