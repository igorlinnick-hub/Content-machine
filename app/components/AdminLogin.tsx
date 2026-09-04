'use client'

import { useEffect, useState } from 'react'

// Marks this browser as one that has signed in as admin before. Not a
// credential — just a hint so the key box is on screen at load.
const ADMIN_DEVICE = 'cm.admin-device'

export function AdminLogin() {
  const [open, setOpen] = useState(false)
  const [focusKey, setFocusKey] = useState(false)
  const [key, setKey] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Password managers only fill fields that exist when the page loads — a box
  // revealed by a click never autofills. So on a device that has signed in as
  // admin before, open the form straight away (without stealing focus from the
  // clinic-code box, which is the front door for everyone else).
  useEffect(() => {
    try {
      if (localStorage.getItem(ADMIN_DEVICE) === '1') setOpen(true)
    } catch {
      // private mode / storage blocked — the "I'm an admin" button still works
    }
  }, [])

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
      try {
        localStorage.setItem(ADMIN_DEVICE, '1')
      } catch {
        // nothing to do — this only costs the next autofill
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
        onClick={() => {
          setOpen(true)
          setFocusKey(true)
        }}
        className="text-xs font-medium text-neutral-400 underline-offset-4 hover:text-neutral-700 hover:underline"
      >
        I&apos;m an admin
      </button>
    )
  }

  return (
    <form
      onSubmit={submit}
      name="admin-signin"
      method="post"
      action="/api/admin/login"
      className="flex w-full max-w-sm flex-col gap-2"
    >
      {/* Keychain and Chrome want a username to hang the saved key on;
          without one a password-only form saves and refills unreliably. */}
      <input
        type="text"
        name="username"
        value="admin"
        autoComplete="username"
        readOnly
        hidden
        tabIndex={-1}
        aria-hidden="true"
      />
      <label className="flex flex-col gap-1 text-left">
        <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
          Admin key
        </span>
        <input
          type="password"
          id="admin-key"
          name="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          autoFocus={focusKey}
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
            setFocusKey(false)
            setError(null)
            setKey('')
            try {
              localStorage.removeItem(ADMIN_DEVICE)
            } catch {
              // ignore — the form just stays collapsed for this visit
            }
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
