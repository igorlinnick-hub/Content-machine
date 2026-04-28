'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Step = 0 | 1 | 2 | 3 | 4

interface State {
  clinicName: string
  doctorName: string
  services: string[]
  deepDiveTopics: string[]
  contentPillars: string[]
  contrarianOpinions: string[]
}

export interface WizardProps {
  mode: 'create' | 'edit'
  initial?: Partial<State>
  welcome?: boolean
  tokenDoctorName?: string | null
}

const STEPS: Array<{ title: string; hint: string; cta: string }> = [
  {
    title: 'Who is this clinic?',
    hint: 'We need a name for the brand and a doctor whose voice will own the channel.',
    cta: 'Continue',
  },
  {
    title: 'What services do you actually offer?',
    hint: 'The concrete menu — PRP, peptides, exosomes, longevity protocols. Add as many as you want.',
    cta: 'Continue',
  },
  {
    title: 'Where do you want to go deep?',
    hint: 'Topics you want to be THE voice on. The writer will go long-form and mechanism-level here.',
    cta: 'Continue',
  },
  {
    title: 'Your content pillars',
    hint: '3–5 recurring themes every week can map to. Categories, not single posts.',
    cta: 'Continue',
  },
  {
    title: 'Opinions most doctors won’t say out loud',
    hint: '2–3 contrarian takes you actually believe. These give the writer a real point of view.',
    cta: 'Finish setup',
  },
]

export default function Wizard({
  mode,
  initial,
  welcome,
  tokenDoctorName,
}: WizardProps) {
  const router = useRouter()
  const [phase, setPhase] = useState<'welcome' | 'wizard'>(
    welcome ? 'welcome' : 'wizard'
  )
  const [step, setStep] = useState<Step>(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<State>({
    clinicName: initial?.clinicName ?? '',
    doctorName: initial?.doctorName || tokenDoctorName || '',
    services: initial?.services ?? [],
    deepDiveTopics: initial?.deepDiveTopics ?? [],
    contentPillars: initial?.contentPillars ?? [],
    contrarianOpinions: initial?.contrarianOpinions ?? [],
  })

  const editing = mode === 'edit'

  if (phase === 'welcome') {
    return (
      <WelcomeIntro
        doctorName={tokenDoctorName ?? null}
        onContinue={() => setPhase('wizard')}
      />
    )
  }

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
        // Edit mode: contrarian opinions are additive — empty is fine.
        return editing || state.contrarianOpinions.length >= 1
      default:
        return false
    }
  }, [step, state, editing])

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/onboarding', {
        method: editing ? 'PATCH' : 'POST',
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
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown error')
      setSubmitting(false)
    }
  }

  const progress = ((step + 1) / STEPS.length) * 100
  const last = step === STEPS.length - 1

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="fixed inset-x-0 top-0 z-10 h-1 bg-neutral-100">
        <div
          className="h-full bg-orange-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-5 pb-12 pt-14 sm:px-6 cm-fade-in">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-neutral-500">
          <Link href="/dashboard" className="hover:text-neutral-900">
            ← Back
          </Link>
          <span className="font-medium text-orange-500">
            {editing ? 'Edit clinic profile' : 'Content Machine setup'}
          </span>
          <span>
            {step + 1} / {STEPS.length}
          </span>
        </div>

        <header className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold leading-tight text-neutral-900 sm:text-4xl">
            {STEPS[step].title}
          </h1>
          <p className="text-base text-neutral-600 sm:text-lg">
            {STEPS[step].hint}
          </p>
        </header>

        <section className="cm-card p-5 sm:p-7">
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
              label={
                editing
                  ? 'Add new contrarian opinions (optional)'
                  : 'Contrarian opinions'
              }
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
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <footer className="mt-auto flex items-center justify-between gap-3 pt-4">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1) as Step)}
            disabled={step === 0 || submitting}
            className="cm-btn cm-btn-ghost text-sm"
          >
            Back
          </button>

          {!last ? (
            <button
              type="button"
              onClick={() => canAdvance && setStep((s) => (s + 1) as Step)}
              disabled={!canAdvance}
              className="cm-btn cm-btn-primary text-base sm:px-7 sm:py-3"
            >
              {STEPS[step].cta}
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!canAdvance || submitting}
              className="cm-btn cm-btn-primary text-base sm:px-7 sm:py-3"
            >
              {submitting
                ? editing
                  ? 'Saving…'
                  : 'Creating clinic…'
                : editing
                  ? 'Save changes'
                  : STEPS[step].cta}
            </button>
          )}
        </footer>
      </div>
    </main>
  )
}

function WelcomeIntro({
  doctorName,
  onContinue,
}: {
  doctorName: string | null
  onContinue: () => void
}) {
  const greeting = doctorName ? `Hey ${doctorName}` : 'Hey there'

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-10 px-5 py-10 sm:px-6 cm-fade-in">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-500">
            Content Machine
          </p>
          <h1 className="text-4xl font-semibold leading-tight text-neutral-900 sm:text-5xl">
            {greeting} 👋
          </h1>
          <p className="text-lg text-neutral-600">
            Take this quick quiz so your AI team writes content that actually
            sounds like <em>you</em> — not generic clinic copy.
          </p>
        </div>

        <ul className="cm-fade-in-stagger flex flex-col gap-3 text-sm text-neutral-700">
          <WelcomeStep
            n={1}
            title="Your clinic & your name"
            why="So we can sign posts in your voice."
          />
          <WelcomeStep
            n={2}
            title="What you actually do"
            why="The real menu of services — not marketing speak."
          />
          <WelcomeStep
            n={3}
            title="What you want to be known for"
            why="Topics where you'll go deep and become THE voice."
          />
          <WelcomeStep
            n={4}
            title="Your weekly content pillars"
            why="3–5 themes every post can map to."
          />
          <WelcomeStep
            n={5}
            title="Opinions most doctors won't say"
            why="Contrarian takes you actually believe — gives the writing real edge."
          />
        </ul>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onContinue}
            className="cm-btn cm-btn-primary self-start text-base sm:px-7 sm:py-3"
          >
            Start the quiz →
          </button>
          <p className="text-xs text-neutral-400">
            Takes about 4 minutes. You can always come back and edit later.
          </p>
        </div>
      </div>
    </main>
  )
}

function WelcomeStep({
  n,
  title,
  why,
}: {
  n: number
  title: string
  why: string
}) {
  return (
    <li className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-500 text-xs font-semibold text-white">
        {n}
      </span>
      <div className="flex flex-col gap-0.5">
        <span className="font-medium text-neutral-900">{title}</span>
        <span className="text-xs text-neutral-500">{why}</span>
      </div>
    </li>
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
          className="cm-input"
        />
      </Field>
      <Field label="Doctor name (primary face of the brand)">
        <input
          type="text"
          value={doctorName}
          onChange={(e) => onChange({ doctorName: e.target.value })}
          placeholder="e.g. Dr. Sarah Chen"
          className="cm-input"
        />
      </Field>
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

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-neutral-800">{label}</span>
        <div className="flex items-start gap-2">
          {multiline ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={placeholder}
              rows={3}
              className="cm-input flex-1 resize-y"
            />
          ) : (
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commit()
                }
              }}
              placeholder={placeholder}
              className="cm-input flex-1"
            />
          )}
          <button
            type="button"
            onClick={commit}
            disabled={!draft.trim()}
            className="cm-btn cm-btn-primary shrink-0 text-sm"
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
              className="flex items-start justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm"
            >
              <span className="flex-1 whitespace-pre-wrap text-neutral-800">
                {item}
              </span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="shrink-0 text-xs font-medium text-neutral-500 transition hover:text-red-600"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
