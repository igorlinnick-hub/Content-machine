'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type Step = 0 | 1 | 2 | 3 | 4

interface State {
  clinicName: string
  doctorName: string
  services: string[]
  deepDiveTopics: string[]
  contentPillars: string[]
  contrarianOpinions: string[]
}

const STEPS: Array<{
  title: string
  hint: string
}> = [
  {
    title: 'Who is this clinic?',
    hint: 'We need a name we can put on posts and a doctor who owns the voice.',
  },
  {
    title: 'What services do you actually offer?',
    hint: 'The concrete menu — PRP, peptides, exosomes, longevity protocols, etc. Add as many as you want.',
  },
  {
    title: 'What should we go deep on?',
    hint: 'Topics you want to be THE voice on. The agent will write long-form, science-first content around these.',
  },
  {
    title: 'Your content pillars',
    hint: '3–5 recurring themes every week can map to. Think categories, not single posts (e.g. "recovery science", "debunking clinic myths").',
  },
  {
    title: 'Opinions most doctors won’t say out loud',
    hint: '2–3 contrarian takes you actually believe. These seed the writer with a point of view instead of generic health content.',
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<State>({
    clinicName: '',
    doctorName: '',
    services: [],
    deepDiveTopics: [],
    contentPillars: [],
    contrarianOpinions: [],
  })

  const canAdvance = useMemo(() => {
    switch (step) {
      case 0:
        return state.clinicName.trim().length > 0
      case 1:
        return state.services.length > 0
      case 2:
        return state.deepDiveTopics.length > 0
      case 3:
        return state.contentPillars.length >= 2
      case 4:
        return state.contrarianOpinions.length >= 1
      default:
        return false
    }
  }, [step, state])

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: state.clinicName.trim(),
          doctor_name: state.doctorName.trim() || undefined,
          services: state.services,
          deep_dive_topics: state.deepDiveTopics,
          content_pillars: state.contentPillars,
          contrarian_opinions: state.contrarianOpinions,
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

  const progress = ((step + 1) / STEPS.length) * 100

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-12">
        <header className="flex flex-col gap-4">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>
              Step {step + 1} / {STEPS.length}
            </span>
            <span>Content Machine setup</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
            <div
              className="h-full rounded-full bg-orange-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{STEPS[step].title}</h1>
            <p className="mt-2 text-sm text-neutral-500">{STEPS[step].hint}</p>
          </div>
        </header>

        <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          {step === 0 && (
            <Step0
              clinicName={state.clinicName}
              doctorName={state.doctorName}
              onChange={(patch) => setState((s) => ({ ...s, ...patch }))}
            />
          )}
          {step === 1 && (
            <TagEditor
              label="Services offered"
              placeholder="e.g. PRP injections, peptide therapy, stem cell protocols"
              items={state.services}
              onChange={(items) => setState((s) => ({ ...s, services: items }))}
            />
          )}
          {step === 2 && (
            <TagEditor
              label="Deep-dive topics"
              placeholder="e.g. mitochondrial recovery, why stem cells aren't a scam, sleep + longevity"
              items={state.deepDiveTopics}
              onChange={(items) =>
                setState((s) => ({ ...s, deepDiveTopics: items }))
              }
            />
          )}
          {step === 3 && (
            <TagEditor
              label="Content pillars (3–5 recurring themes)"
              placeholder="e.g. clinic myths, recovery science, patient stories"
              items={state.contentPillars}
              onChange={(items) =>
                setState((s) => ({ ...s, contentPillars: items }))
              }
            />
          )}
          {step === 4 && (
            <TagEditor
              label="Contrarian opinions"
              placeholder='e.g. "Ice baths for recovery are oversold for most patients"'
              items={state.contrarianOpinions}
              onChange={(items) =>
                setState((s) => ({ ...s, contrarianOpinions: items }))
              }
              multiline
            />
          )}
        </section>

        {error && (
          <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <footer className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep((s) => (Math.max(0, s - 1) as Step))}
            disabled={step === 0 || submitting}
            className="rounded-lg px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 disabled:opacity-40"
          >
            Back
          </button>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => canAdvance && setStep((s) => (s + 1) as Step)}
              disabled={!canAdvance}
              className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-600 disabled:opacity-40"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!canAdvance || submitting}
              className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-600 disabled:opacity-40"
            >
              {submitting ? 'Creating clinic…' : 'Finish setup'}
            </button>
          )}
        </footer>
      </div>
    </main>
  )
}

function Step0({
  clinicName,
  doctorName,
  onChange,
}: {
  clinicName: string
  doctorName: string
  onChange: (patch: Partial<State>) => void
}) {
  return (
    <div className="flex flex-col gap-5">
      <Field label="Clinic name" required>
        <input
          type="text"
          value={clinicName}
          onChange={(e) => onChange({ clinicName: e.target.value })}
          placeholder="e.g. Regen Health Clinic"
          className="input"
        />
      </Field>
      <Field label="Doctor name (primary face of the brand)">
        <input
          type="text"
          value={doctorName}
          onChange={(e) => onChange({ doctorName: e.target.value })}
          placeholder="e.g. Dr. Sarah Chen"
          className="input"
        />
      </Field>
      <style jsx>{`
        .input {
          width: 100%;
          border: 1px solid #d4d4d4;
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 14px;
          background: white;
        }
        .input:focus {
          outline: 2px solid #f97316;
          outline-offset: 1px;
          border-color: transparent;
        }
      `}</style>
    </div>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-neutral-800">
        {label}
        {required && <span className="text-orange-500"> *</span>}
      </span>
      {children}
    </label>
  )
}

function TagEditor({
  label,
  placeholder,
  items,
  onChange,
  multiline,
}: {
  label: string
  placeholder: string
  items: string[]
  onChange: (items: string[]) => void
  multiline?: boolean
}) {
  const [draft, setDraft] = useState('')

  function commit() {
    const text = draft.trim()
    if (!text) return
    onChange([...items, text])
    setDraft('')
  }

  function remove(idx: number) {
    onChange(items.filter((_, i) => i !== idx))
  }

  const InputTag = multiline ? 'textarea' : 'input'

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-neutral-800">{label}</span>
        <div className="flex items-start gap-2">
          <InputTag
            value={draft}
            onChange={(
              e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
            ) => setDraft(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (!multiline && e.key === 'Enter') {
                e.preventDefault()
                commit()
              }
            }}
            placeholder={placeholder}
            rows={multiline ? 3 : undefined}
            className="input flex-1"
          />
          <button
            type="button"
            onClick={commit}
            className="shrink-0 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Add
          </button>
        </div>
      </label>

      {items.length === 0 ? (
        <p className="text-xs text-neutral-500">Nothing added yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item, i) => (
            <li
              key={`${i}-${item}`}
              className="flex items-start justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm"
            >
              <span className="flex-1 whitespace-pre-wrap text-neutral-800">
                {item}
              </span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-xs text-neutral-500 hover:text-red-600"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <style jsx>{`
        .input {
          border: 1px solid #d4d4d4;
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 14px;
          background: white;
          font-family: inherit;
          resize: vertical;
        }
        .input:focus {
          outline: 2px solid #f97316;
          outline-offset: 1px;
          border-color: transparent;
        }
      `}</style>
    </div>
  )
}
