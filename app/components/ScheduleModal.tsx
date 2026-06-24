'use client'

import { useState, useEffect } from 'react'

// ── Platform icons ─────────────────────────────────────────────────────────────

const IgIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
  </svg>
)
const FbIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
)
const TtIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.26 8.26 0 004.84 1.56V6.81a4.85 4.85 0 01-1.07-.12z"/>
  </svg>
)

export const CHANNEL_CONFIG = {
  instagram: { label: 'Instagram', color: '#E1306C', icon: <IgIcon /> },
  facebook:  { label: 'Facebook',  color: '#1877F2', icon: <FbIcon /> },
  tiktok:    { label: 'TikTok',    color: '#010101', icon: <TtIcon /> },
} as const

export type ChannelId = keyof typeof CHANNEL_CONFIG

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScheduleModalProps {
  open: boolean
  onClose: () => void
  clinicId: string
  slideSetId?: string
  initialCaption?: string
  initialMediaUrl?: string
  initialChannels?: ChannelId[]
  initialScheduledAt?: string
  editId?: string          // if set → PATCH mode
  onSaved?: (post: ScheduledPostRow) => void
}

export interface ScheduledPostRow {
  id: string
  slide_set_id: string | null
  caption: string
  media_url: string | null
  channels: string[]
  scheduled_at: string | null
  buffer_ids: Record<string, string>
  status: string
  created_at: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ScheduleModal({
  open, onClose, clinicId, slideSetId,
  initialCaption = '', initialMediaUrl = '',
  initialChannels = ['instagram', 'facebook'],
  initialScheduledAt = '',
  editId, onSaved,
}: ScheduleModalProps) {
  const [caption,     setCaption]     = useState(initialCaption)
  const [mediaUrl,    setMediaUrl]    = useState(initialMediaUrl)
  const [channels,    setChannels]    = useState<Set<ChannelId>>(new Set(initialChannels))
  const [scheduledAt, setScheduledAt] = useState(initialScheduledAt)
  const [loading,     setLoading]     = useState(false)
  const [result,      setResult]      = useState<string | null>(null)
  const [resultOk,    setResultOk]    = useState(false)

  // Sync props when modal re-opens for a different post
  useEffect(() => {
    if (open) {
      setCaption(initialCaption)
      setMediaUrl(initialMediaUrl)
      setChannels(new Set(initialChannels))
      setScheduledAt(initialScheduledAt)
      setResult(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, slideSetId, editId])

  if (!open) return null

  function toggleChannel(id: ChannelId) {
    setChannels(prev => {
      const next = new Set(prev)
      if (next.has(id)) { if (next.size > 1) next.delete(id) }
      else next.add(id)
      return next
    })
  }

  async function submit() {
    if (!caption.trim()) { setResult('Caption required'); setResultOk(false); return }
    setLoading(true); setResult(null)

    try {
      const url    = editId ? `/api/scheduled-posts/${editId}` : '/api/scheduled-posts'
      const method = editId ? 'PATCH' : 'POST'
      const body   = editId
        ? { caption, mediaUrl: mediaUrl || undefined, channels: Array.from(channels), scheduledAt: scheduledAt || null }
        : { clinicId, slideSetId, caption, mediaUrl: mediaUrl || undefined, channels: Array.from(channels), scheduledAt: scheduledAt || undefined }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)

      setResultOk(true)
      const chLabels = Array.from(channels).map(c => CHANNEL_CONFIG[c].label).join(', ')
      const sent = Object.keys((data as ScheduledPostRow).buffer_ids ?? {})
      setResult(sent.length
        ? `Sent to Buffer: ${sent.join(', ')}`
        : `Saved as draft · Channels: ${chLabels}`)
      onSaved?.(data as ScheduledPostRow)
    } catch (e) {
      setResultOk(false)
      setResult(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-lg -translate-y-1/2 rounded-2xl border border-white/20 bg-white p-6 shadow-2xl sm:inset-x-auto sm:left-1/2 sm:w-full sm:-translate-x-1/2">

        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-neutral-900">
            {editId ? 'Edit scheduled post' : 'Schedule to publish'}
          </h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {/* Caption */}
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Caption
            </label>
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              rows={4}
              placeholder="Post caption / text..."
              className="w-full resize-none rounded-xl border border-neutral-200 px-3 py-2.5 text-[13px] text-neutral-800 placeholder-neutral-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400/30"
            />
          </div>

          {/* Media URL */}
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Image / video URL
              <span className="ml-1 font-normal text-neutral-400">(required for IG & TikTok)</span>
            </label>
            <input
              type="url"
              value={mediaUrl}
              onChange={e => setMediaUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-[13px] text-neutral-700 placeholder-neutral-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400/30"
            />
          </div>

          {/* Channels + Time row */}
          <div className="flex flex-wrap items-end gap-4">
            {/* Channels */}
            <div className="flex-1">
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Channels
              </label>
              <div className="flex gap-2">
                {(Object.entries(CHANNEL_CONFIG) as [ChannelId, typeof CHANNEL_CONFIG[ChannelId]][]).map(([id, cfg]) => {
                  const on = channels.has(id)
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleChannel(id)}
                      className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition"
                      style={{
                        borderColor: on ? cfg.color : '#e5e7eb',
                        background:  on ? `${cfg.color}12` : 'white',
                        color: on ? cfg.color : '#9ca3af',
                      }}
                    >
                      <span style={{ color: on ? cfg.color : '#d1d5db' }}>{cfg.icon}</span>
                      {cfg.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Date/time */}
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Date & time
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                className="rounded-xl border border-neutral-200 px-3 py-2 text-[13px] text-neutral-700 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400/30"
              />
              <p className="mt-1 text-[10px] text-neutral-400">Empty = add to queue as draft</p>
            </div>
          </div>

          {/* Result */}
          {result && (
            <div className={`rounded-xl px-3 py-2 text-[12px] ${resultOk ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
              {result}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-[13px] font-medium text-neutral-600 hover:bg-neutral-100">
              {resultOk ? 'Close' : 'Cancel'}
            </button>
            {!resultOk && (
              <button
                onClick={submit}
                disabled={loading || !caption.trim()}
                className="rounded-lg bg-sky-500 px-5 py-2 text-[13px] font-semibold text-white transition hover:bg-sky-600 disabled:opacity-50"
              >
                {loading ? 'Sending…' : scheduledAt ? 'Schedule via Buffer' : 'Save as Draft'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
