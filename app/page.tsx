import { redirect } from 'next/navigation'
import { resolveAccess } from '@/lib/auth/session'
import { SessionRestore } from './components/SessionRestore'
import { AdminLogin } from './components/AdminLogin'
import { DoctorLogin } from './components/DoctorLogin'
import { Logomark } from './components/Logomark'

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
    <main className="relative min-h-screen overflow-hidden bg-white text-neutral-900">
      <SessionRestore />

      {/* Ambient orange glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-[15%] -top-32 h-[520px] w-[520px] rounded-full bg-sky-200/45 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-[12%] top-[55%] h-[420px] w-[420px] rounded-full bg-sky-100/60 blur-3xl"
      />

      <div className="relative mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-12 px-5 py-12 sm:gap-14 sm:px-6 sm:py-16">
        <div className="flex flex-col gap-5 cm-fade-in">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-sky-500">
            <Logomark size={20} />
            Content Machine
          </p>
          <h1 className="text-balance text-4xl font-semibold leading-[1.05] text-neutral-900 sm:text-6xl">
            An AI team that writes
            <br />
            <span className="text-neutral-400">
              in your voice. About you.
            </span>
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-neutral-600 sm:text-xl">
            Built for regenerative-medicine doctors. Your clinic sends you a
            one-time install link — open it on your phone once and your team
            of agents goes to work.
          </p>
        </div>

        {errorMsg && (
          <div
            className="cm-fade-in rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            style={{ animationDelay: '0.1s' }}
          >
            {errorMsg}
          </div>
        )}

        <div
          className="flex flex-col gap-5 cm-fade-in"
          style={{ animationDelay: '0.2s' }}
        >
          <DoctorLogin />
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-neutral-300">
            <span className="h-px flex-1 bg-neutral-200" />
            or
            <span className="h-px flex-1 bg-neutral-200" />
          </div>
          <AdminLogin />
        </div>
      </div>
    </main>
  )
}
