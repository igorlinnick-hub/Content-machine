import { redirect } from 'next/navigation'
import { resolveAccess } from '@/lib/auth/session'
import { Logomark } from '@/app/components/Logomark'
import { PWAInstallCard } from '@/app/dashboard/components/PWAInstallCard'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function InstallPage() {
  const access = await resolveAccess()
  if (!access) redirect('/')
  if (access.role === 'admin') redirect('/clinics')

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-5 py-12">
      <div className="w-full max-w-sm flex flex-col gap-8 cm-fade-in">
        <div className="flex flex-col gap-3 text-center">
          <p className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-sky-500">
            <Logomark size={18} />
            Hawaii Wellness Clinic
          </p>
          <h1 className="text-2xl font-semibold text-neutral-900">
            Add to your Home Screen
          </h1>
          <p className="text-sm text-neutral-500">
            Install the app once — open it like any other app on your phone.
          </p>
        </div>

        <PWAInstallCard clinicId={access.clinicId} isAdmin={false} />

        <p className="text-center text-xs text-neutral-400">
          Already installed?{' '}
          <Link href="/dashboard" className="text-sky-600 hover:underline">
            Go to dashboard →
          </Link>
        </p>
      </div>
    </main>
  )
}
