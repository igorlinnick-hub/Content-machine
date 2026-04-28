/* eslint-disable @next/next/no-img-element */
'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface Props {
  clinicId: string
}

interface Link {
  token: string
  url: string
  doctorName: string | null
  lastUsedAt: string | null
}

export function InstallLinkCard({ clinicId }: Props) {
  const [links, setLinks] = useState<Link[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doctorName, setDoctorName] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(
          `/api/admin/install-link?clinicId=${encodeURIComponent(clinicId)}`
        )
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
        setLinks(data.links ?? [])
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

  async function generate(revokeExisting: boolean) {
    if (!doctorName.trim()) {
      setError("Enter the doctor's first name first.")
      return
    }
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/install-link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clinicId,
          revokeExisting,
          doctorName: doctorName.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      const newLink: Link = {
        token: data.token,
        url: data.url,
        doctorName: data.doctorName ?? doctorName.trim(),
        lastUsedAt: null,
      }
      setLinks(revokeExisting ? [newLink] : [newLink, ...links])
      setDoctorName('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to generate')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <section className="cm-card p-5">
      <header className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-orange-500">
          Doctor install link
        </h3>
        <p className="text-sm text-neutral-600">
          Send this once. Doctor opens in Safari → Add to Home Screen → done.
          On first open they&apos;ll see a personalized welcome and walk through the
          setup quiz themselves.
        </p>
      </header>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Doctor first name
          </span>
          <input
            type="text"
            value={doctorName}
            onChange={(e) => setDoctorName(e.target.value)}
            placeholder="Shawn"
            className="cm-input text-sm"
            disabled={generating}
          />
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => generate(false)}
            disabled={generating || !doctorName.trim()}
            className="cm-btn cm-btn-primary text-xs"
          >
            {generating ? 'Generating…' : 'Generate link'}
          </button>
          {links.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (
                  confirm(
                    'Revoke all existing doctor links and generate a fresh one? Anyone with the old links loses access immediately.'
                  )
                ) {
                  generate(true)
                }
              }}
              disabled={generating || !doctorName.trim()}
              className="cm-btn cm-btn-ghost text-xs text-red-600"
            >
              Revoke + new
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-4 text-xs text-neutral-500">Loading…</p>
      ) : links.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-600">
          No active links yet. Enter the doctor&apos;s first name and click{' '}
          <em>Generate link</em>.
        </p>
      ) : (
        <ul className="mt-5 flex flex-col gap-4">
          {links.map((l) => (
            <LinkRow key={l.token} link={l} />
          ))}
        </ul>
      )}
    </section>
  )
}

function LinkRow({ link }: { link: Link }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(link.url, { width: 192, margin: 1 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [link.url])

  async function copy() {
    try {
      await navigator.clipboard.writeText(link.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  const status = link.lastUsedAt ? 'Used' : 'Unused'

  return (
    <li className="flex flex-col items-start gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 sm:flex-row">
      <div className="shrink-0 rounded bg-white p-2 ring-1 ring-neutral-200">
        {qrDataUrl ? (
          <img src={qrDataUrl} alt="QR code" width={160} height={160} />
        ) : (
          <div className="h-[160px] w-[160px] animate-pulse rounded bg-neutral-100" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {link.doctorName && (
            <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700">
              Dr. {link.doctorName}
            </span>
          )}
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[11px] uppercase tracking-wider ${
              link.lastUsedAt
                ? 'border-neutral-200 bg-white text-neutral-500'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}
          >
            {status}
          </span>
        </div>
        <code className="break-all rounded bg-white px-3 py-2 text-xs text-neutral-800 ring-1 ring-neutral-200">
          {link.url}
        </code>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copy}
            className="cm-btn cm-btn-primary text-xs"
          >
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="cm-btn cm-btn-ghost text-xs"
          >
            Open
          </a>
        </div>
        <p className="text-xs text-neutral-500">
          Scan QR with the doctor&apos;s phone, or send the link via SMS / Telegram.
        </p>
      </div>
    </li>
  )
}
