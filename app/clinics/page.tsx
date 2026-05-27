import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { resolveAccess } from '@/lib/auth/session'
import { RoleBadge } from '@/app/components/RoleBadge'
import { BrandCard } from '@/app/dashboard/components/BrandCard'
import { InstallLinkCard } from '@/app/dashboard/components/InstallLinkCard'
import { ClinicProfileEditor } from './components/ClinicProfileEditor'
import { ClinicSwitcher } from './components/ClinicSwitcher'
import { ViewAsButton } from './components/ViewAsButton'

export const dynamic = 'force-dynamic'

// Clinic hub — the proper home for everything per-clinic that isn't
// content work itself. Replaces the old /settings which only had brand
// + install link. Now an admin can:
//   • see all clinics at a glance
//   • switch context (and jump to per-clinic work surfaces)
//   • edit profile inline (name, services, pillars, audience, tone, …)
//   • manage brand styling + install link
//   • add a new clinic (links to /onboarding)
// Doctors are redirected to /dashboard — they manage themselves through
// the onboarding edit flow on first visit.

interface ClinicsPageProps {
  searchParams: { clinicId?: string }
}

interface ClinicRow {
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
  logo_url?: string | null
}

export default async function ClinicsPage({ searchParams }: ClinicsPageProps) {
  const access = await resolveAccess()
  if (!access) redirect('/')
  if (access.role !== 'admin') redirect('/dashboard')

  const supabase = createServerClient()
  const { data: clinicsRaw, error } = await supabase
    .from('clinics')
    .select(
      'id, name, niche, doctor_name, services, audience, tone, medical_restrictions, content_pillars, deep_dive_topics, logo_url'
    )
    .order('created_at', { ascending: true })
  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-10">
        <p className="cm-card p-6 text-sm text-red-700">
          Failed to load clinics: {error.message}
        </p>
      </main>
    )
  }

  const clinics = (clinicsRaw ?? []) as ClinicRow[]
  if (clinics.length === 0) redirect('/onboarding')

  const selectedId = searchParams.clinicId ?? clinics[0].id
  const selected = clinics.find((c) => c.id === selectedId) ?? clinics[0]

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-5 py-6 sm:px-6 sm:py-8">
      <header className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-sky-500">
            Back-office
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-neutral-900">
            Clinics — {clinics.length}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Manage profiles, brand, and install links for every clinic on this
            account. Pick one below to edit; jump back to its dashboard or
            library anytime.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard?clinicId=${selected.id}`}
            className="cm-btn cm-btn-ghost text-sm"
          >
            ← Dashboard
          </Link>
          <RoleBadge role="admin" />
        </div>
      </header>

      <ClinicSwitcher clinics={clinics} selectedId={selected.id} />

      {/* Per-clinic quick-jump strip — admins live in /dashboard or
          /arsenal so make jumps one click away. ViewAsButton lets the
          admin see the dashboard the way this clinic's doctor sees
          it (cookie-based override, exit via banner). */}
      <nav className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium text-neutral-600">
          {selected.name} →
        </span>
        <Link
          href={`/dashboard?clinicId=${selected.id}`}
          className="cm-btn cm-btn-ghost text-xs"
        >
          📝 Posts
        </Link>
        <Link
          href={`/arsenal?clinicId=${selected.id}`}
          className="cm-btn cm-btn-ghost text-xs"
        >
          🧱 Library
        </Link>
        <Link
          href={`/visual?clinicId=${selected.id}`}
          className="cm-btn cm-btn-ghost text-xs"
        >
          🎨 Visual posts
        </Link>
        <span className="text-neutral-300">·</span>
        <ViewAsButton clinicId={selected.id} clinicName={selected.name} />
      </nav>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
          1. Profile — what the writer knows about this clinic
        </h2>
        <ClinicProfileEditor clinic={selected} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
          2. Brand — logo / colours on every slide
        </h2>
        <BrandCard clinicId={selected.id} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
          3. Doctor install link
        </h2>
        <InstallLinkCard clinicId={selected.id} />
      </section>
    </main>
  )
}
