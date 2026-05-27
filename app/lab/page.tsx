import Link from 'next/link'
import { redirect } from 'next/navigation'
import { loadClinicList } from '@/lib/supabase/context'
import { resolveAccess } from '@/lib/auth/session'
import { RoleBadge } from '@/app/components/RoleBadge'
import { ImageLab } from './components/ImageLab'

export const dynamic = 'force-dynamic'

// Image Lab — admin-only sandbox for Replicate image generation.
// Plays the same role for images that Replicate's own playground
// plays for video: type a prompt, pick a model + aspect, see the
// result. No save-to-library wiring yet — that's the next pass,
// once we know which model/aspect combos actually look good on
// slide backgrounds. Until then this is purely exploratory.

interface LabPageProps {
  searchParams: { clinicId?: string }
}

export default async function LabPage({ searchParams }: LabPageProps) {
  const access = await resolveAccess()
  if (!access) redirect('/')
  if (access.role !== 'admin') redirect('/dashboard')

  const clinics = await loadClinicList()
  if (clinics.length === 0) redirect('/onboarding')

  const clinicId = searchParams.clinicId ?? clinics[0].id
  const clinic = clinics.find((c) => c.id === clinicId) ?? clinics[0]

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-5 py-6 sm:px-6 sm:py-8">
      <header className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-fuchsia-500">
            Back-office · Sandbox
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-neutral-900">
            🎨 Image Lab
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Type a prompt → pick a model + aspect → see what comes back from
            Replicate. Cheap exploration before we wire any of these into
            slide backgrounds. {clinic.name} is selected for any future
            save-to-library actions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard?clinicId=${clinic.id}`}
            className="cm-btn cm-btn-ghost text-sm"
          >
            ← Dashboard
          </Link>
          <RoleBadge role="admin" />
        </div>
      </header>

      <ImageLab clinicId={clinic.id} clinicName={clinic.name} compact={false} />
    </main>
  )
}
