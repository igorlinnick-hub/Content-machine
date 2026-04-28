/* eslint-disable @next/next/no-img-element */
'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  clinicId: string
}

const ACCEPTED = 'image/png,image/jpeg,image/webp,image/svg+xml'

export function BrandCard({ clinicId }: Props) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(
          `/api/admin/clinic-logo?clinicId=${encodeURIComponent(clinicId)}`
        )
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
        setLogoUrl(data.logoUrl ?? null)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [clinicId])

  async function upload(file: File) {
    setBusy(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('clinicId', clinicId)
      form.append('file', file)
      const res = await fetch('/api/admin/clinic-logo', {
        method: 'POST',
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      setLogoUrl(data.logoUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'upload failed')
    } finally {
      setBusy(false)
    }
  }

  async function clear() {
    if (!confirm('Remove the clinic logo? It will disappear from new slides.')) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/admin/clinic-logo?clinicId=${encodeURIComponent(clinicId)}`,
        { method: 'DELETE' }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      setLogoUrl(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'remove failed')
    } finally {
      setBusy(false)
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void upload(file)
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) void upload(file)
    e.target.value = ''
  }

  return (
    <section className="cm-card p-5">
      <header className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-orange-500">
          Clinic logo
        </h3>
        <p className="text-sm text-neutral-600">
          Saved on the clinic, not the doctor link. Appears on every slide
          generated for this clinic. PNG, JPG, WebP or SVG, up to 2 MB.
        </p>
      </header>

      <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row">
        {/* Preview */}
        <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          {loading ? (
            <span className="text-xs text-neutral-400">Loading…</span>
          ) : logoUrl ? (
            <img
              src={logoUrl}
              alt="Clinic logo"
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="text-center text-xs text-neutral-400">
              No logo
              <br />
              yet
            </span>
          )}
        </div>

        {/* Drop zone + actions */}
        <div className="flex flex-1 flex-col gap-2">
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center transition ${
              dragOver
                ? 'border-orange-400 bg-orange-50'
                : 'border-neutral-200 bg-neutral-50 hover:border-orange-300 hover:bg-orange-50/50'
            }`}
          >
            <p className="text-sm font-medium text-neutral-800">
              {busy
                ? 'Uploading…'
                : logoUrl
                  ? 'Drop or click to replace'
                  : 'Drop or click to upload'}
            </p>
            <p className="text-xs text-neutral-500">
              PNG · JPG · WebP · SVG · max 2 MB
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED}
              onChange={onPickFile}
              className="hidden"
              disabled={busy}
            />
          </div>

          {logoUrl && (
            <button
              type="button"
              onClick={clear}
              disabled={busy}
              className="cm-btn cm-btn-ghost self-start text-xs text-red-600"
            >
              Remove logo
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </section>
  )
}
