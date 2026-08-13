'use client'

import { useState } from 'react'

export function DoctorLogin() {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const raw = value.trim()
    if (!raw) {
      setError('Type the code or paste the install link.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      // Server resolves whatever was typed: a /c/<token> URL, a raw
      // token, or a memorable code. On success it sets the cookie and
      // returns 200; we then bounce to the dashboard.
      const res = await fetch('/api/auth/restore', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: raw }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          data?.error ??
            (res.status === 429
              ? 'Too many attempts. Try again later.'
              : 'Invalid code or link.')
        )
      }
      window.location.assign('/dashboard')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed')
      setSubmitting(false)
    }
  }

  // Always open — the code box is the front door of the app. Everyone gets
  // the same base URL and signs in by typing their clinic code.
  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-2">
      <label className="flex flex-col gap-1 text-left">
        <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
          Your code
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="hwc-doctor"
          className="cm-input font-mono text-base"
          disabled={submitting}
        />
      </label>
      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={!value.trim() || submitting}
        className="cm-btn cm-btn-primary w-full text-sm"
      >
        {submitting ? 'Signing in…' : 'Continue'}
      </button>
      <p className="text-[11px] text-neutral-400">
        Type the short code from your clinic, or paste the full link. This
        device stays signed in for a year.
      </p>
    </form>
  )
}
