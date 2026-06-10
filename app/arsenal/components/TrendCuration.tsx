'use client'

import { useState } from 'react'
import type { TrendSource, TrendPlatform, TrendKind } from '@/lib/trends/sources'

const PLATFORMS: TrendPlatform[] = ['instagram', 'tiktok', 'youtube']
const KINDS: TrendKind[] = ['account', 'hashtag']

const PLATFORM_LABEL: Record<TrendPlatform, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
}

// Admin surface for the semi-automatic trend pool: which accounts /
// hashtags the weekly cron scans. The cron seeds the ingest queue from
// the active rows; the local skill does the heavy pull; approved drafts
// land in the arsenal (above) and feed the Studio board.
export function TrendCuration({
  clinicId,
  initialSources,
}: {
  clinicId: string
  initialSources: TrendSource[]
}) {
  const [sources, setSources] = useState(initialSources)
  const [platform, setPlatform] = useState<TrendPlatform>('instagram')
  const [kind, setKind] = useState<TrendKind>('account')
  const [handle, setHandle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function add() {
    const trimmed = handle.trim()
    if (!trimmed) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/trend-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicId,
          platform,
          kind,
          handle_or_hashtag: trimmed,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setError(data.error || 'Failed to add')
        return
      }
      setSources((prev) => {
        const without = prev.filter((s) => s.id !== data.source.id)
        return [data.source, ...without]
      })
      setHandle('')
    } finally {
      setBusy(false)
    }
  }

  async function toggle(s: TrendSource) {
    const next = !s.active
    setSources((prev) =>
      prev.map((x) => (x.id === s.id ? { ...x, active: next } : x))
    )
    await fetch(`/api/trend-sources/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinicId, active: next }),
    })
  }

  async function remove(s: TrendSource) {
    setSources((prev) => prev.filter((x) => x.id !== s.id))
    await fetch(`/api/trend-sources/${s.id}?clinicId=${clinicId}`, {
      method: 'DELETE',
    })
  }

  return (
    <div className="cm-card flex flex-col gap-4 p-4">
      <p className="text-sm text-neutral-600">
        The weekly scan pulls fresh videos from these accounts / hashtags into
        the ingest queue. Approve the good ones above — they join the Studio
        pool.
      </p>

      {/* Add row */}
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          Platform
          <select
            className="cm-input"
            value={platform}
            onChange={(e) => setPlatform(e.target.value as TrendPlatform)}
          >
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {PLATFORM_LABEL[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          Type
          <select
            className="cm-input"
            value={kind}
            onChange={(e) => setKind(e.target.value as TrendKind)}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1 text-xs text-neutral-500">
          {kind === 'account' ? 'Handle (@name)' : 'Hashtag (#tag)'}
          <input
            className="cm-input"
            value={handle}
            placeholder={kind === 'account' ? '@drsmith' : '#regenmed'}
            onChange={(e) => setHandle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') add()
            }}
          />
        </label>
        <button
          type="button"
          onClick={add}
          disabled={busy || !handle.trim()}
          className="cm-btn cm-btn-primary text-sm"
        >
          {busy ? 'Adding…' : 'Add source'}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}

      {/* List */}
      {sources.length === 0 ? (
        <p className="text-sm text-neutral-400">No sources yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sources.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2"
            >
              <div className="flex items-center gap-2 text-sm">
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                  {PLATFORM_LABEL[s.platform]} · {s.kind}
                </span>
                <span className="font-medium text-neutral-900">
                  {s.handle_or_hashtag}
                </span>
                {s.last_scanned_at && (
                  <span className="text-xs text-neutral-400">
                    scanned {new Date(s.last_scanned_at).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggle(s)}
                  className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                    s.active
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                  }`}
                >
                  {s.active ? 'Active' : 'Paused'}
                </button>
                <button
                  type="button"
                  onClick={() => remove(s)}
                  className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
