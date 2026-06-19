'use client'

import { useState } from 'react'
import { clearStoredToken } from '@/lib/clinic-storage'

interface Props {
  role: 'admin' | 'doctor' | 'editor'
  doctorName?: string | null
  variant?: 'light' | 'dark'
}

export function RoleBadge({ role, doctorName, variant = 'light' }: Props) {
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  async function signOut() {
    setSigningOut(true)
    try {
      clearStoredToken()
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // ignore
    } finally {
      window.location.replace('/')
    }
  }

  const isAdmin = role === 'admin'
  const label = isAdmin ? 'Admin' : doctorName ? `Dr. ${doctorName}` : 'Doctor'
  const dotCls = isAdmin ? 'bg-sky-400' : 'bg-neutral-400'

  const ringCls = variant === 'dark'
    ? 'border-white/12 bg-white/10 text-white/80 hover:bg-white/15 backdrop-blur-sm'
    : isAdmin
      ? 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100'
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
          <div className="absolute right-0 top-full z-20 mt-2 w-48 overflow-hidden rounded-xl border border-neutral-100 bg-white shadow-xl">
            <div className="px-4 py-3 border-b border-neutral-100">
              <p className="text-[11px] text-neutral-400">Signed in as</p>
              <p className="mt-0.5 text-sm font-semibold text-neutral-900">{label}</p>
            </div>
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              className="w-full px-4 py-2.5 text-left text-sm text-red-500 hover:bg-red-50 transition-colors"
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
