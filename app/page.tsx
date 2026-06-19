import { redirect } from 'next/navigation'
import { resolveAccess } from '@/lib/auth/session'
import { SessionRestore } from './components/SessionRestore'
import { AdminLogin } from './components/AdminLogin'
import { DoctorLogin } from './components/DoctorLogin'
import { Logomark } from './components/Logomark'
import { HeroBg } from './dashboard/components/HeroBg'

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
      ? 'That install link is invalid or has been revoked. Ask your clinic for a fresh one.'
      : searchParams.error === 'invalid_admin'
        ? 'Admin key is invalid.'
        : null

  return (
    <main className="relative min-h-screen overflow-hidden">
      <SessionRestore />

      {/* Full-screen animated shader */}
      <HeroBg className="absolute inset-0 h-full w-full" />

      {/* Content centered on top */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-5 py-12">
        <div className="w-full max-w-[420px]">

          {/* Title — white on dark shader */}
          <div className="mb-7 cm-rise" style={{ animationDelay: '0ms' }}>
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-300">
              <Logomark size={18} />
              Hawaii Wellness Clinic
            </p>
            <h1
              className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl cm-rise"
              style={{ animationDelay: '80ms' }}
            >
              Content Studio
            </h1>
            <p
              className="mt-2 text-base text-white/55 cm-rise"
              style={{ animationDelay: '160ms' }}
            >
              Sign in with your team code or install link.
            </p>
          </div>

          {/* Glass card — forms */}
          <div
            className="rounded-3xl border border-white/20 bg-white/88 p-7 shadow-[0_24px_64px_rgba(0,0,0,0.35)] backdrop-blur-2xl cm-rise"
            style={{ animationDelay: '220ms' }}
          >
            {errorMsg && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMsg}
              </div>
            )}

            <div className="flex flex-col gap-5">
              <DoctorLogin />
              <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.22em] text-neutral-300">
                <span className="h-px flex-1 bg-neutral-200" />
                or
                <span className="h-px flex-1 bg-neutral-200" />
              </div>
              <AdminLogin />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
