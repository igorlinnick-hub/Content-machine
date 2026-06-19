import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { resolveAccess } from '@/lib/auth/session'
import { RoleBadge } from '@/app/components/RoleBadge'
import { PageHeader } from '@/app/components/PageHeader'
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
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-5 py-8 cm-page-bg sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Back-office · Clinics"
        title={`Clinics — ${clinics.length}`}
        subtitle="Manage profiles, brand, and install links. Pick a clinic below to edit."
        back={`/dashboard?clinicId=${selected.id}`}
        right={<RoleBadge role="admin" />}
      />

      <ClinicSwitcher clinics={clinics} selectedId={selected.id} />

      <nav className="flex flex-wrap items-center gap-2 -mt-2">
        <span className="text-xs font-semibold text-neutral-500">{selected.name} →</span>
        {[
          { href: `/dashboard?clinicId=${selected.id}`, label: '📝 Posts' },
          { href: `/arsenal?clinicId=${selected.id}`,   label: '🧱 Library' },
          { href: `/visual?clinicId=${selected.id}`,    label: '🎨 Visual' },
        ].map(({ href, label }) => (
          <Link key={href} href={href} className="rounded-xl border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600 transition hover:bg-neutral-50 hover:shadow-sm">
            {label}
          </Link>
        ))}
        <span className="text-neutral-200">·</span>
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
