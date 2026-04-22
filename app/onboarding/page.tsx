'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Tone = 'professional' | 'educational' | 'conversational'

export default function OnboardingPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [doctorName, setDoctorName] = useState('')
  const [services, setServices] = useState('')
  const [audience, setAudience] = useState('')
  const [tone, setTone] = useState<Tone>('educational')
  const [restrictions, setRestrictions] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          doctor_name: doctorName.trim() || undefined,
          services: splitCsv(services),
          audience: audience.trim() || undefined,
          tone,
          medical_restrictions: splitCsv(restrictions),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      router.push(`/dashboard?clinicId=${data.clinic.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown error')
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold">Clinic onboarding</h1>
        <p className="mt-1 text-sm text-neutral-500">
          One-time setup. This profile feeds every script the agents write.
        </p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label="Clinic name" required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="input"
            placeholder="e.g. Regen Health Clinic"
          />
        </Field>

        <Field label="Doctor name">
          <input
            type="text"
            value={doctorName}
            onChange={(e) => setDoctorName(e.target.value)}
            className="input"
            placeholder="e.g. Dr. Sarah Chen"
          />
        </Field>

        <Field label="Services" hint="Comma-separated (e.g. PRP, stem cells, peptides)">
          <input
            type="text"
            value={services}
            onChange={(e) => setServices(e.target.value)}
            className="input"
          />
        </Field>

        <Field label="Audience">
          <input
            type="text"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            className="input"
            placeholder="e.g. health-conscious adults 35–60 interested in longevity"
          />
        </Field>

        <Field label="Tone">
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value as Tone)}
            className="input"
          >
            <option value="educational">Educational</option>
            <option value="professional">Professional</option>
            <option value="conversational">Conversational</option>
          </select>
        </Field>

        <Field
          label="Medical restrictions"
          hint="Comma-separated — things the doctor must never claim or promise"
        >
          <input
            type="text"
            value={restrictions}
            onChange={(e) => setRestrictions(e.target.value)}
            className="input"
            placeholder="e.g. no cure claims, no guaranteed outcomes"
          />
        </Field>

        {error && (
          <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? 'Creating clinic…' : 'Create clinic'}
        </button>
      </form>

      <style jsx>{`
        .input {
          width: 100%;
          border: 1px solid #d4d4d4;
          border-radius: 6px;
          padding: 8px 10px;
          font-size: 14px;
          background: white;
        }
        .input:focus {
          outline: 2px solid #0a0a0a;
          outline-offset: 1px;
        }
      `}</style>
    </main>
  )
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
      {hint && <span className="text-xs text-neutral-500">{hint}</span>}
    </label>
  )
}

function splitCsv(s: string): string[] {
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
}
