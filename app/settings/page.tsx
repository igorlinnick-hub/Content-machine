import Link from 'next/link'
import { redirect } from 'next/navigation'
import { resolveAccess } from '@/lib/auth/session'
import { loadClinicList } from '@/lib/supabase/context'
import { BrandCard } from '@/app/dashboard/components/BrandCard'
import { InstallLinkCard } from '@/app/dashboard/components/InstallLinkCard'
import { RoleBadge } from '@/app/components/RoleBadge'

export const dynamic = 'force-dynamic'

interface SettingsPageProps {
  searchParams: { clinicId?: string }
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const access = await resolveAccess()
  if (!access) redirect('/')
  if (access.role !== 'admin') redirect('/dashboard')

  const clinics = await loadClinicList()
  if (clinics.length === 0) redirect('/onboarding')

  const clinicId = searchParams.clinicId ?? clinics[0].id
  const clinic = clinics.find((c) => c.id === clinicId) ?? clinics[0]

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-5 py-8 sm:px-6 sm:py-10">
      <header className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-5">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-sky-500">
            Settings
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-neutral-900">
            {clinic.name}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Brand assets and doctor access. Rarely changes — set once and forget.
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

      {clinics.length > 1 && (
        <nav className="flex flex-wrap gap-1.5">
          {clinics.map((c) => (
            <Link
              key={c.id}
              href={`/settings?clinicId=${c.id}`}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                c.id === clinicId
                  ? 'bg-neutral-900 text-white'
                  : 'border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              {c.name}
            </Link>
          ))}
        </nav>
      )}

      <BrandCard clinicId={clinic.id} />

      <section className="cm-card p-5">
        <header className="flex flex-col gap-1 pb-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-500">
            Doctor install link
          </h3>
          <p className="text-xs text-neutral-500">
            Generate or revoke the link you send to a doctor.
          </p>
        </header>
        <InstallLinkCard clinicId={clinic.id} />
      </section>
    </main>
  )
}
