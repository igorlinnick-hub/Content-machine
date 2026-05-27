'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface AdminPreviewBannerProps {
  clinicName: string
  doctorName: string | null
}

// Sticky banner rendered at the top of any page when an admin is
// previewing the doctor surface (resolveAccess returned DoctorAccess
// with adminPreview=true). Single "Exit preview" button clears the
// cm_view_as cookie and reloads — admin cookie is still there so
// they snap right back to the admin surface.

export function AdminPreviewBanner({
  clinicName,
  doctorName,
}: AdminPreviewBannerProps) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function exit(): Promise<void> {
    setBusy(true)
    try {
      await fetch('/api/admin/view-as', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ exit: true }),
      })
      // Hop back to /clinics (admin's home) — and force SSR so the
      // refreshed cookie state is read.
      router.push('/clinics')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-amber-300 bg-amber-100 px-4 py-2 text-xs font-medium text-amber-900">
      <span>
        👁 Admin preview — you are seeing {clinicName}
        {doctorName ? ` (Dr. ${doctorName})` : ''} as the doctor would.
      </span>
      <button
        type="button"
        onClick={() => void exit()}
        disabled={busy}
        className="rounded-md border border-amber-400 bg-white px-2 py-0.5 text-[11px] font-semibold text-amber-900 transition hover:bg-amber-50 disabled:opacity-50"
      >
        {busy ? '…' : 'Exit preview ✕'}
      </button>
    </div>
  )
}
