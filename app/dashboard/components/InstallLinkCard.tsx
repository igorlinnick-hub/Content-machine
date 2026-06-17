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
  role: 'doctor' | 'editor'
  doctorName: string | null
  code: string | null
  lastUsedAt: string | null
}

export function InstallLinkCard({ clinicId }: Props) {
  const [links, setLinks] = useState<Link[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doctorName, setDoctorName] = useState('')
  const [role, setRole] = useState<'doctor' | 'editor'>('doctor')
  const [code, setCode] = useState('')

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
      setError(
        role === 'doctor'
          ? "Enter the doctor's first name first."
          : "Enter the team member's name first."
      )
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
          role,
          code: code.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      const newLink: Link = {
        token: data.token,
        url: data.url,
        role: data.role ?? role,
        doctorName: data.doctorName ?? doctorName.trim(),
        code: data.code ?? null,
        lastUsedAt: null,
      }
      setLinks(
        revokeExisting
          ? [newLink, ...links.filter((l) => l.role !== role)]
          : [newLink, ...links]
      )
      setDoctorName('')
      setCode('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to generate')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <details className="rounded-lg border border-sky-200 bg-sky-50 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-sky-900">
          How to share access (link or code)
        </summary>
        <ol className="mt-3 flex flex-col gap-2 text-sm text-neutral-700">
          <li>
            <span className="font-semibold text-neutral-900">Option A — link:</span>{' '}
            send the URL by SMS / WhatsApp / Telegram, or have them scan the QR.
            One click logs them in for a year.
          </li>
          <li>
            <span className="font-semibold text-neutral-900">Option B — code:</span>{' '}
            give them the memorable code (e.g. <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">hwc-team-2026</code>).
            They open the app and type it on the sign-in screen. Same one-year
            session.
          </li>
          <li>
            <span className="font-semibold text-neutral-900">iPhone install:</span>{' '}
            after sign-in tap Share → <strong>Add to Home Screen</strong>.
            Opens fullscreen, no browser bar.
          </li>
        </ol>
        <p className="mt-3 text-xs text-neutral-500">
          Codes and links share the same session — anyone with either is in
          until you revoke. Cookie lasts a year per device.
        </p>
      </details>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:flex-wrap">
        <label className="flex flex-col gap-1 sm:w-32">
          <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Role
          </span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'doctor' | 'editor')}
            className="cm-input text-sm"
            disabled={generating}
          >
            <option value="doctor">Doctor</option>
            <option value="editor">Team member</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 sm:flex-1">
          <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            {role === 'doctor' ? 'Doctor name' : 'Team member name'}
          </span>
          <input
            type="text"
            value={doctorName}
            onChange={(e) => setDoctorName(e.target.value)}
            placeholder={role === 'doctor' ? 'Shawn' : 'Marketing'}
            className="cm-input text-sm"
            disabled={generating}
          />
        </label>
        <label className="flex flex-col gap-1 sm:flex-1">
          <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Login code <span className="text-neutral-400">(optional)</span>
          </span>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={role === 'doctor' ? 'hwc-doctor' : 'hwc-team-2026'}
            className="cm-input font-mono text-sm"
            disabled={generating}
            maxLength={32}
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
          {links.some((l) => l.role === role) && (
            <button
              type="button"
              onClick={() => {
                const label = role === 'doctor' ? 'doctor' : 'team'
                if (
                  confirm(
                    `Revoke all existing ${label} links and generate a fresh one? Anyone with the old links loses access immediately.`
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
  const [codeCopied, setCodeCopied] = useState(false)
  const [editingCode, setEditingCode] = useState(false)
  const [codeDraft, setCodeDraft] = useState(link.code ?? '')
  const [codeValue, setCodeValue] = useState(link.code)
  const [savingCode, setSavingCode] = useState(false)
  const [codeError, setCodeError] = useState<string | null>(null)

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

  async function copy(text: string, kind: 'link' | 'code') {
    try {
      await navigator.clipboard.writeText(text)
      if (kind === 'link') {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      } else {
        setCodeCopied(true)
        setTimeout(() => setCodeCopied(false), 1500)
      }
    } catch {
      // ignore
    }
  }

  async function saveCode() {
    setSavingCode(true)
    setCodeError(null)
    try {
      const res = await fetch('/api/admin/install-link', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          token: link.token,
          code: codeDraft.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      setCodeValue(data.code ?? null)
      setEditingCode(false)
    } catch (e) {
      setCodeError(e instanceof Error ? e.message : 'failed to save')
    } finally {
      setSavingCode(false)
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
            <span
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                link.role === 'editor'
                  ? 'border-violet-200 bg-violet-50 text-violet-700'
                  : 'border-sky-200 bg-sky-50 text-sky-700'
              }`}
            >
              {link.role === 'editor' ? '' : 'Dr. '}
              {link.doctorName}
            </span>
          )}
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[11px] uppercase tracking-wider ${
              link.role === 'editor'
                ? 'border-violet-200 bg-violet-50 text-violet-700'
                : 'border-neutral-200 bg-white text-neutral-600'
            }`}
          >
            {link.role === 'editor' ? 'Team' : 'Doctor'}
          </span>
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
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wider text-neutral-500">
              Login code
            </span>
            {editingCode ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={codeDraft}
                  onChange={(e) => setCodeDraft(e.target.value)}
                  placeholder="hwc-team-2026"
                  maxLength={32}
                  className="cm-input flex-1 font-mono text-sm"
                  disabled={savingCode}
                />
                <button
                  type="button"
                  onClick={saveCode}
                  disabled={savingCode}
                  className="cm-btn cm-btn-primary text-xs"
                >
                  {savingCode ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingCode(false)
                    setCodeDraft(codeValue ?? '')
                    setCodeError(null)
                  }}
                  className="cm-btn cm-btn-ghost text-xs"
                  disabled={savingCode}
                >
                  Cancel
                </button>
              </div>
            ) : codeValue ? (
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded bg-amber-50 px-3 py-1.5 font-mono text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
                  {codeValue}
                </code>
                <button
                  type="button"
                  onClick={() => copy(codeValue, 'code')}
                  className="cm-btn cm-btn-ghost text-xs"
                >
                  {codeCopied ? 'Copied!' : 'Copy code'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCodeDraft(codeValue)
                    setEditingCode(true)
                  }}
                  className="cm-btn cm-btn-ghost text-xs"
                >
                  Edit
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setCodeDraft('')
                  setEditingCode(true)
                }}
                className="cm-btn cm-btn-ghost text-xs self-start"
              >
                + Add login code
              </button>
            )}
            {codeError && (
              <p className="text-xs text-red-600">{codeError}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wider text-neutral-500">
              Install link
            </span>
            <code className="break-all rounded bg-white px-3 py-2 text-xs text-neutral-800 ring-1 ring-neutral-200">
              {link.url}
            </code>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => copy(link.url, 'link')}
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
