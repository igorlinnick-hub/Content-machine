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
    <main className="flex min-h-screen flex-col items-center justify-center px-5 py-16">
      <SessionRestore />

      <div className="w-full max-w-[400px]">
        {/* Wordmark */}
        <div className="mb-8 cm-rise" style={{ animationDelay: '0ms' }}>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-900 shadow-sm">
              <Logomark size={18} className="text-white" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-neutral-900">
              Content Machine
            </span>
          </div>
          <h1
            className="mt-6 text-[2.6rem] font-bold leading-[1.1] tracking-tighter text-neutral-900 cm-rise"
            style={{ animationDelay: '60ms' }}
          >
            Sign in to your<br />workspace
          </h1>
          <p
            className="mt-3 text-[15px] leading-relaxed text-neutral-500 cm-rise"
            style={{ animationDelay: '120ms' }}
          >
            Enter your team code or use your clinic install link.
          </p>
        </div>

        {/* Glass card */}
        <div
          className="cm-rise rounded-3xl p-7"
          style={{
            animationDelay: '180ms',
            background: 'rgba(255,255,255,0.65)',
            backdropFilter: 'blur(24px) saturate(1.8)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
            border: '1px solid rgba(255,255,255,0.75)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.08), 0 1px 0 rgba(255,255,255,0.9) inset',
          }}
        >
          {errorMsg && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMsg}
            </div>
          )}
          <div className="flex flex-col gap-5">
            <DoctorLogin />
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-neutral-200/70" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">or</span>
              <span className="h-px flex-1 bg-neutral-200/70" />
            </div>
            <AdminLogin />
          </div>
        </div>

        <p
          className="mt-6 text-center text-xs text-neutral-400 cm-rise"
          style={{ animationDelay: '260ms' }}
        >
          Hawaii Wellness Clinic · regen-med content platform
        </p>
      </div>
    </main>
  )
}
