import { redirect } from 'next/navigation'
import { resolveAccess } from '@/lib/auth/session'
import { SessionRestore } from './components/SessionRestore'
import { AdminLogin } from './components/AdminLogin'
import { DoctorLogin } from './components/DoctorLogin'

export const dynamic = 'force-dynamic'

export default async function Home({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const access = await resolveAccess()
  if (access) redirect('/dashboard')

  const errorMsg =
    searchParams.error === 'invalid_link'
      ? 'That install link is invalid or has been revoked. Ask the clinic admin for a new one.'
      : searchParams.error === 'invalid_admin'
        ? 'Admin key is invalid.'
        : null

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6">
      <SessionRestore />
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-500">
          Content Machine
        </p>
        <h1 className="text-4xl font-semibold leading-tight text-neutral-900 sm:text-5xl">
          AI content ops for regenerative-medicine clinics.
        </h1>
        <p className="text-base text-neutral-600">
          This app is invite-only. If you have an install link from your clinic,
          open it once and add it to your home screen.
        </p>
        {errorMsg && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMsg}
          </p>
        )}
        <div className="mt-4 flex w-full flex-col items-center gap-3">
          <DoctorLogin />
          <span className="text-[11px] uppercase tracking-[0.16em] text-neutral-300">
            or
          </span>
          <AdminLogin />
        </div>
      </div>
    </main>
  )
}
