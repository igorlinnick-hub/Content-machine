'use client'

import { useState } from 'react'

function extractToken(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null
  // Accept either a full install-link URL (…/c/<token>) or the bare token.
  const slashIdx = raw.lastIndexOf('/c/')
  if (slashIdx >= 0) {
    const tail = raw.slice(slashIdx + 3).split(/[?#]/)[0]
    return tail.length > 0 ? tail : null
  }
  // Bare token: alphanum + url-safe base64 chars only.
  return /^[A-Za-z0-9_-]+$/.test(raw) ? raw : null
}

export function DoctorLogin() {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const token = extractToken(value)
    if (!token) {
      setError('Paste the full install link your clinic sent you.')
      return
    }
    window.location.assign(`/c/${token}`)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-neutral-500 underline-offset-4 hover:text-neutral-800 hover:underline"
      >
        I have an install link
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-2">
      <label className="flex flex-col gap-1 text-left">
        <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
          Install link
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          placeholder="Paste the link from your clinic"
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
            setValue('')
          }}
          className="cm-btn cm-btn-ghost text-xs"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!value.trim()}
          className="cm-btn cm-btn-primary flex-1 text-sm"
        >
          Continue
        </button>
      </div>
      <p className="text-[11px] text-neutral-400">
        Paste the full link or just the code. Tap once on this device, then it
        remembers you for a year.
      </p>
    </form>
  )
}
