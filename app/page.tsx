import { redirect } from 'next/navigation'
import Image from 'next/image'
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
      ? 'That install link is invalid or has been revoked. Ask your clinic for a fresh one.'
      : searchParams.error === 'invalid_admin'
        ? 'Admin key is invalid.'
        : null

  return (
    <main className="min-h-screen bg-white lg:grid lg:min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <SessionRestore />

      {/* ── Brand side ────────────────────────────────────────────────────────
          Desktop: a full-height photo column. Mobile: a banner above the sheet.
          The clinic's own Hawaii photography, never a stock stand-in. */}
      <section className="relative h-[30vh] min-h-[190px] w-full overflow-hidden lg:h-auto lg:min-h-screen">
        <Image
          src="/brand/hwc-hero.jpg"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 55vw, 100vw"
          className="object-cover"
          style={{ objectPosition: '50% 58%' }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgba(13,47,66,0.42) 0%, rgba(13,47,66,0.10) 55%, rgba(13,47,66,0.20) 100%)',
          }}
        />
        {/* Desktop-only strapline — the clinic's own tagline, set in Playfair
            over a dark wash so the serif stays readable on the photo. */}
        <div className="absolute inset-x-0 bottom-0 hidden p-12 lg:block">
          <div
            className="absolute inset-x-0 bottom-0 h-2/3"
            style={{
              background:
                'linear-gradient(to top, rgba(13,47,66,0.72) 0%, rgba(13,47,66,0.30) 55%, transparent 100%)',
            }}
          />
          <p className="relative text-[11px] font-semibold uppercase tracking-[0.24em] text-white/70">
            Hawaii Wellness Clinic
          </p>
          <p className="hwc-display relative mt-3 max-w-md text-[2rem] leading-[1.2] text-white">
            Advanced therapies for mind and body
          </p>
        </div>
      </section>

      {/* ── Form side ─────────────────────────────────────────────────────── */}
      <section
        className="relative z-10 -mt-7 rounded-t-[28px] bg-white px-5 pb-16 pt-9 lg:mt-0 lg:flex lg:items-center lg:rounded-none lg:px-14 lg:py-16"
        style={{ boxShadow: '0 -8px 28px rgba(13,47,66,0.10)' }}
      >
        <div className="mx-auto w-full max-w-[400px]">
          {/* Real logo asset, on white so every letter stays sharp */}
          <div className="cm-rise flex justify-center lg:justify-start">
            <Image
              src="/brand/hwc-logo.png"
              alt="Hawaii Wellness Clinic"
              width={1466}
              height={553}
              priority
              sizes="220px"
              className="h-auto w-[220px]"
            />
          </div>

          <h1
            className="hwc-display cm-rise mt-7 text-center text-[2rem] leading-[1.15] lg:text-left lg:text-[2.4rem]"
            style={{ animationDelay: '60ms', color: 'var(--hwc-ocean-dark)' }}
          >
            Sign in to your workspace
          </h1>
          <p
            className="cm-rise mt-3 text-center text-[15px] font-light leading-relaxed lg:text-left"
            style={{ animationDelay: '120ms', color: '#5a7a6a' }}
          >
            Enter your team code, or open the install link your clinic sent you.
          </p>

          <div
            className="hwc-form cm-rise mt-8 rounded-3xl p-7"
            style={{
              animationDelay: '180ms',
              background: '#fff',
              border: '1px solid rgba(58,174,160,0.22)',
              boxShadow: '0 10px 40px rgba(27,79,110,0.10)',
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
                <span className="h-px flex-1" style={{ background: 'rgba(58,174,160,0.22)' }} />
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                  or
                </span>
                <span className="h-px flex-1" style={{ background: 'rgba(58,174,160,0.22)' }} />
              </div>
              <AdminLogin />
            </div>
          </div>

          <p
            className="cm-rise mt-6 text-center text-xs lg:text-left"
            style={{ animationDelay: '260ms', color: '#8aa398' }}
          >
            Can&apos;t sign in? Ask your clinic for a fresh install link.
          </p>
        </div>
      </section>
    </main>
  )
}
