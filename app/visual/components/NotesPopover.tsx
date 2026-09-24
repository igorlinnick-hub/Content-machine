'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'

// The generator's doorway into the Notes tab. Notes are written
// elsewhere (the Notes workspace, lib/notes/ideas.ts); this only reads
// them, so one idea can go from "thought I had in the car" to a
// generated post without retyping it.
//
// Server-rendered props, not a fetch: /visual is already a dynamic
// server page, so `router.refresh()` on open re-runs it and picks up
// notes written in another tab. That keeps this component free of any
// API route the Notes session might also be creating.

export interface NoteOption {
  id: string
  title: string | null
  body: string
  pinned: boolean
  source: 'typed' | 'photo'
  updated_at: string
}

interface Props {
  notes: NoteOption[]
  onPick: (note: NoteOption) => void
  disabled?: boolean
  accent?: string
}

/** First sentence, or the first line — whatever is shorter. */
export function noteHeadline(note: NoteOption): string {
  if (note.title?.trim()) return note.title.trim()
  const firstLine = note.body.trim().split('\n')[0] ?? ''
  const firstSentence = firstLine.split(/(?<=[.!?])\s/)[0] ?? firstLine
  const pick = firstSentence.length > 0 ? firstSentence : firstLine
  return pick.length > 90 ? `${pick.slice(0, 87).trimEnd()}…` : pick
}

function relativeDay(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const days = Math.floor((Date.now() - then) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function NotesPopover({ notes, onPick, disabled, accent = '#6366f1' }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const router = useRouter()

  // Re-run the server page so a note written in the Notes tab a moment
  // ago is in the list by the time it renders.
  useEffect(() => {
    if (open) router.refresh()
  }, [open, router])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return notes
    return notes.filter(
      (n) =>
        (n.title ?? '').toLowerCase().includes(q) || n.body.toLowerCase().includes(q)
    )
  }, [notes, query])

  const sheet =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              flexDirection: 'column',
              background: '#fff',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid #f1f5f9',
                padding: '16px 20px',
                flexShrink: 0,
              }}
            >
              <div>
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.15em',
                    color: '#94a3b8',
                    margin: 0,
                  }}
                >
                  Pick an idea
                </p>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '2px 0 0' }}>
                  Notes
                </h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close notes"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: '#f1f5f9',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748b',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M1 1l12 12M13 1L1 13"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div style={{ padding: '12px 16px 0', flexShrink: 0 }}>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your notes…"
                className="cm-input text-sm"
              />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              {filtered.length === 0 ? (
                <p style={{ fontSize: 13, color: '#64748b', margin: '8px 2px' }}>
                  {notes.length === 0
                    ? 'No notes yet. Anything you write in the Notes tab shows up here.'
                    : 'Nothing matches that.'}
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filtered.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        onPick(n)
                        setOpen(false)
                        setQuery('')
                      }}
                      title="Drop this idea into the generator"
                      style={{
                        textAlign: 'left',
                        borderRadius: 12,
                        border: '1px solid #e2e8f0',
                        background: '#f8fafc',
                        padding: '12px 14px',
                        cursor: 'pointer',
                      }}
                    >
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}
                      >
                        {n.pinned && (
                          <span
                            style={{
                              borderRadius: 999,
                              background: '#eef2ff',
                              padding: '1px 8px',
                              fontSize: 10,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.08em',
                              color: '#6366f1',
                            }}
                          >
                            Pinned
                          </span>
                        )}
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                          {noteHeadline(n)}
                        </span>
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8' }}>
                          {n.source === 'photo' ? 'photo · ' : ''}
                          {relativeDay(n.updated_at)}
                        </span>
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 12.5,
                          lineHeight: 1.5,
                          color: '#64748b',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {n.body}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>,
          document.body
        )
      : null

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        title="Take an idea from your notes"
        className="shrink-0 rounded-lg border px-3 py-1 text-[11px] font-semibold transition hover:opacity-80 disabled:opacity-50"
        style={{ color: accent, borderColor: `${accent}55`, background: `${accent}14` }}
      >
        Notes{notes.length > 0 ? ` · ${notes.length}` : ''}
      </button>
      {sheet}
    </>
  )
}
