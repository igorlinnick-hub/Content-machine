'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

interface MiniClinic {
  id: string
  name: string
  doctor_name: string | null
  services: string[] | null
}

interface ClinicSwitcherProps {
  clinics: MiniClinic[]
  selectedId: string
}

// Horizontal chip row for switching between clinics + "+ New clinic"
// CTA. Server reads ?clinicId from the URL; we just update it on click.
// At 5+ clinics this gets noisy — graduate to a dropdown then.

export function ClinicSwitcher({ clinics, selectedId }: ClinicSwitcherProps) {
  const router = useRouter()
  const params = useSearchParams()

  function pick(id: string): void {
    const next = new URLSearchParams(params)
    next.set('clinicId', id)
    router.push(`/clinics?${next.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {clinics.map((c) => {
        const active = c.id === selectedId
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => pick(c.id)}
            className={`flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition ${
              active
                ? 'border-sky-400 bg-sky-50 ring-2 ring-sky-200'
                : 'border-neutral-200 bg-white hover:border-sky-200'
            }`}
          >
            <span className="text-sm font-semibold text-neutral-900">
              {c.name}
            </span>
            <span className="text-[11px] text-neutral-500">
              {c.doctor_name ? `Dr. ${c.doctor_name}` : 'no doctor on file'}
              {c.services && c.services.length > 0 && (
                <> · {c.services.slice(0, 2).join(', ')}</>
              )}
            </span>
          </button>
        )
      })}
      <Link
        href="/onboarding"
        className="rounded-lg border border-dashed border-violet-300 bg-violet-50/40 px-3 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-100"
      >
        + New clinic
      </Link>
    </div>
  )
}
