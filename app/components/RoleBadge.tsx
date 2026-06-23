'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { clearStoredToken } from '@/lib/clinic-storage'

interface Props {
  role: 'admin' | 'doctor' | 'editor'
  doctorName?: string | null
  variant?: 'light' | 'dark'
}

export function RoleBadge({ role, doctorName, variant = 'light' }: Props) {
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  async function signOut() {
    setSigningOut(true)
    try {
      clearStoredToken()
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch { /* ignore */ }
    finally { window.location.replace('/') }
  }

  function toggle() {
    if (!open && btnRef.current) {
      setRect(btnRef.current.getBoundingClientRect())
    }
    setOpen((s) => !s)
  }

  // Reposition on scroll/resize while open
  useEffect(() => {
    if (!open) return
    function update() {
      if (btnRef.current) setRect(btnRef.current.getBoundingClientRect())
    }
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open])

  const isAdmin = role === 'admin'
  const label = isAdmin ? 'Admin' : doctorName ? `Dr. ${doctorName}` : 'Doctor'
  const dotCls = isAdmin ? 'bg-sky-400' : 'bg-neutral-400'
  const ringCls = variant === 'dark'
    ? 'border-white/12 bg-white/10 text-white/80 hover:bg-white/15 backdrop-blur-sm'
    : isAdmin
      ? 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100'
      : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100'

  const dropdown = open && rect && typeof document !== 'undefined'
    ? createPortal(
        <>
          {/* backdrop */}
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          {/* menu — fixed, anchored to button's screen position */}
          <div
            className="fixed z-50 w-52 overflow-hidden rounded-xl border border-neutral-100 bg-white shadow-2xl"
            style={{
              top: rect.bottom + 8,
              right: Math.max(8, window.innerWidth - rect.right),
            }}
          >
            <div className="border-b border-neutral-100 px-4 py-3">
              <p className="text-[11px] text-neutral-400">Signed in as</p>
              <p className="mt-0.5 text-sm font-semibold text-neutral-900">{label}</p>
            </div>
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              className="w-full px-4 py-3 text-left text-sm font-medium text-red-500 transition-colors hover:bg-red-50"
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </>,
        document.body
      )
    : null

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${ringCls}`}
      >
        <span className={`h-2 w-2 rounded-full ${dotCls}`} aria-hidden />
        {label}
        <span className="text-neutral-400" aria-hidden>▾</span>
      </button>
      {dropdown}
    </div>
  )
}
