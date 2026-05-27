'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface ViewAsButtonProps {
  clinicId: string
  clinicName: string
}

// One button to start previewing the doctor surface for this clinic.
// Sets the cm_view_as cookie via POST /api/admin/view-as, then router
// .refresh() so the existing /clinics page re-resolves access — admin
// stays admin in the cookie, but resolveAccess returns a synthetic
// DoctorAccess and the user lands on /dashboard rendered as doctor.

export function ViewAsButton({ clinicId, clinicName }: ViewAsButtonProps) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function enterPreview(): Promise<void> {
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch('/api/admin/view-as', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clinicId }),
      })
      const payload = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !payload.ok) {
        setErr(payload.error ?? `request failed (${res.status})`)
        return
      }
      // Hop to dashboard — the doctor's natural landing surface.
      // router.push triggers SSR which now sees view-as cookie and
      // hands back DoctorAccess.
      router.push('/dashboard')
      router.refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'network error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => void enterPreview()}
        disabled={busy}
        className="cm-btn cm-btn-ghost text-xs"
        title={`See dashboard the way Dr. at ${clinicName} sees it`}
      >
        {busy ? '…' : '👁 View as doctor'}
      </button>
      {err && <span className="text-[11px] text-rose-600">{err}</span>}
    </div>
  )
}
