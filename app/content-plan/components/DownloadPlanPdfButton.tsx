'use client'

import { useState } from 'react'

export function DownloadPlanPdfButton({ clinicId }: { clinicId: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function download() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/content-plan/pdf?clinicId=${encodeURIComponent(clinicId)}`)
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const filename =
        res.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] ??
        'content-plan.pdf'
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      // Give the browser a moment to start the download before revoking
      setTimeout(() => URL.revokeObjectURL(objectUrl), 4000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'download failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className="flex shrink-0 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white/70 px-4 py-2 text-sm font-semibold text-neutral-700 shadow-sm backdrop-blur transition hover:bg-white disabled:opacity-50"
      >
        {busy ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
            Preparing PDF…
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Download PDF
          </>
        )}
      </button>
      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  )
}
