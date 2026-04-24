'use client'

import { useState } from 'react'
import { clearStoredToken } from '@/lib/clinic-storage'

interface Props {
  role: 'admin' | 'doctor' | 'editor'
  doctorName?: string | null
}

export function RoleBadge({ role, doctorName }: Props) {
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  async function signOut() {
    setSigningOut(true)
    try {
      // Wipe localStorage backup so PWA doesn't auto-restore the session.
      clearStoredToken()
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // ignore
    } finally {
      window.location.replace('/')
    }
  }

  const isAdmin = role === 'admin'
  const label = isAdmin ? 'Admin' : doctorName ? `Doctor: ${doctorName}` : 'Doctor'
  const dotCls = isAdmin ? 'bg-orange-500' : 'bg-neutral-400'
  const ringCls = isAdmin
    ? 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100'
    : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100'

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${ringCls}`}
      >
        <span className={`h-2 w-2 rounded-full ${dotCls}`} aria-hidden />
        {label}
        <span className="text-neutral-400" aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-lg border border-neutral-200 bg-white p-3 text-sm shadow-lg">
            <p className="text-xs uppercase tracking-wider text-neutral-500">
              Signed in as
            </p>
            <p className="mt-1 font-medium text-neutral-900">{label}</p>
            {isAdmin && (
              <p className="mt-2 text-xs text-neutral-500">
                Want to preview as the doctor? Open the install link in a private window.
              </p>
            )}
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              className="mt-3 w-full cm-btn cm-btn-ghost text-xs text-red-600"
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
