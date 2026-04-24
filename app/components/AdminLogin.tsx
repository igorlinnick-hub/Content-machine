'use client'

import { useState } from 'react'

export function AdminLogin() {
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!key.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: key.trim() }),
      })
      if (res.status === 401) {
        setError('Wrong key')
        setSubmitting(false)
        return
      }
      if (!res.ok) {
        setError(`HTTP ${res.status}`)
        setSubmitting(false)
        return
      }
      window.location.replace('/dashboard')
    } catch {
      setError('Network error')
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-neutral-400 underline-offset-4 hover:text-neutral-700 hover:underline"
      >
        I&apos;m an admin
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-2">
      <label className="flex flex-col gap-1 text-left">
        <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
          Admin key
        </span>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          autoFocus
          autoComplete="current-password"
          placeholder="Paste your admin key"
          className="cm-input text-sm"
        />
      </label>
      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setError(null)
            setKey('')
          }}
          className="cm-btn cm-btn-ghost text-xs"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || !key.trim()}
          className="cm-btn cm-btn-primary flex-1 text-sm"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </div>
      <p className="text-[11px] text-neutral-400">
        Saved in this browser for a year. No need to enter again on this device.
      </p>
    </form>
  )
}
