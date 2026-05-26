'use client'

import { useState } from 'react'

interface ClinicProfile {
  id: string
  name: string
  niche: string | null
  doctor_name: string | null
  services: string[] | null
  audience: string | null
  tone: string | null
  medical_restrictions: string[] | null
  content_pillars: string[] | null
  deep_dive_topics: string[] | null
}

interface ClinicProfileEditorProps {
  clinic: ClinicProfile
}

// Inline editor for the bits of the clinic profile the Writer actually
// reads: niche, services, audience, tone, content_pillars,
// deep_dive_topics, medical_restrictions. The whole thing is one form
// so the admin doesn't have to save section-by-section. Save PATCHes
// /api/admin/clinic/[id] which writes to the same row loadSharedContext
// queries on every script generation — no cache, no propagation delay.

function joinList(list: string[] | null | undefined): string {
  return (list ?? []).join(', ')
}

function parseList(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export function ClinicProfileEditor({ clinic }: ClinicProfileEditorProps) {
  const [name, setName] = useState(clinic.name)
  const [doctorName, setDoctorName] = useState(clinic.doctor_name ?? '')
  const [niche, setNiche] = useState(clinic.niche ?? 'regenerative_medicine')
  const [services, setServices] = useState(joinList(clinic.services))
  const [audience, setAudience] = useState(clinic.audience ?? '')
  const [tone, setTone] = useState(clinic.tone ?? '')
  const [pillars, setPillars] = useState(joinList(clinic.content_pillars))
  const [deepDive, setDeepDive] = useState(joinList(clinic.deep_dive_topics))
  const [restrictions, setRestrictions] = useState(
    joinList(clinic.medical_restrictions)
  )
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function save(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    setErr(null)
    try {
      const res = await fetch(`/api/admin/clinic/${clinic.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          doctor_name: doctorName.trim() || null,
          niche: niche.trim() || null,
          services: parseList(services),
          audience: audience.trim() || null,
          tone: tone.trim() || null,
          content_pillars: parseList(pillars),
          deep_dive_topics: parseList(deepDive),
          medical_restrictions: parseList(restrictions),
        }),
      })
      const payload = (await res.json()) as { error?: string }
      if (!res.ok) {
        setErr(payload.error ?? `save failed (${res.status})`)
        return
      }
      setMsg('Saved. Writer sees the new profile on the next generation.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'network error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={save}
      className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Clinic name *">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            required
            className="cm-input text-sm"
          />
        </Field>
        <Field label="Doctor name (for slides + voice)">
          <input
            value={doctorName}
            onChange={(e) => setDoctorName(e.target.value)}
            disabled={busy}
            className="cm-input text-sm"
          />
        </Field>
        <Field label="Niche (writer's domain framing)">
          <input
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            disabled={busy}
            placeholder="e.g. regenerative_medicine"
            className="cm-input font-mono text-sm"
          />
        </Field>
        <Field label="Audience">
          <input
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            disabled={busy}
            placeholder="e.g. 35-65 wellness-seekers who tried mainstream"
            className="cm-input text-sm"
          />
        </Field>
        <Field label="Voice / tone">
          <input
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            disabled={busy}
            placeholder="e.g. warm, expert, anti-clickbait"
            className="cm-input text-sm"
          />
        </Field>
        <Field label="Services (comma-separated)">
          <input
            value={services}
            onChange={(e) => setServices(e.target.value)}
            disabled={busy}
            placeholder="ketamine therapy, TMS, PRP, peptides"
            className="cm-input text-sm"
          />
        </Field>
      </div>

      <Field label="Content pillars (the Writer rotates through these)">
        <textarea
          value={pillars}
          onChange={(e) => setPillars(e.target.value)}
          disabled={busy}
          rows={2}
          placeholder="patient stories, mechanism explainers, mainstream critiques"
          className="cm-input resize-y text-sm"
        />
      </Field>

      <Field label="Deep-dive topics">
        <textarea
          value={deepDive}
          onChange={(e) => setDeepDive(e.target.value)}
          disabled={busy}
          rows={2}
          placeholder="ketamine for depression, PRP for knees, GLP-1 alternatives"
          className="cm-input resize-y text-sm"
        />
      </Field>

      <Field label="Medical restrictions (writer never claims these)">
        <textarea
          value={restrictions}
          onChange={(e) => setRestrictions(e.target.value)}
          disabled={busy}
          rows={2}
          placeholder='"cures cancer", "FDA approved" without context'
          className="cm-input resize-y text-sm"
        />
      </Field>

      <div className="flex items-center justify-between gap-3 border-t border-neutral-100 pt-3">
        <span className="text-[11px] text-neutral-500">
          Changes apply on the next script generation.
        </span>
        <div className="flex items-center gap-2">
          {msg && <span className="text-xs text-emerald-600">{msg}</span>}
          {err && <span className="text-xs text-rose-600">{err}</span>}
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="cm-btn cm-btn-primary text-sm"
          >
            {busy ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </div>
    </form>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium text-neutral-700">{label}</span>
      {children}
    </label>
  )
}
