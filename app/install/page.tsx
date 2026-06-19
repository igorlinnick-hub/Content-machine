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
    <main className="flex min-h-screen flex-col items-center justify-center cm-page-bg px-5 py-12">
      <div className="flex w-full max-w-sm flex-col gap-7">
        <div className="flex flex-col gap-2 cm-rise">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-500">
            <Logomark size={16} />
            Hawaii Wellness Clinic
          </p>
          <h1
            className="text-3xl font-bold tracking-tight text-neutral-900 cm-rise"
            style={{ animationDelay: '70ms' }}
          >
            Add to Home Screen
          </h1>
          <p
            className="text-sm text-neutral-500 cm-rise"
            style={{ animationDelay: '140ms' }}
          >
            Install once — open it like any other app.
          </p>
        </div>

        <div className="cm-rise" style={{ animationDelay: '200ms' }}>
          <PWAInstallCard clinicId={access.clinicId} isAdmin={false} />
        </div>

        <p
          className="text-center text-xs text-neutral-400 cm-rise"
          style={{ animationDelay: '280ms' }}
        >
          Already installed?{' '}
          <Link href="/dashboard" className="font-medium text-sky-600 hover:underline">
            Go to dashboard →
          </Link>
        </p>
      </div>
    </main>
  )
}
