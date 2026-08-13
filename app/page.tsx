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
    // Tinted ground rather than flat white, so the card reads as an object
    // sitting on the page instead of a seam splitting the screen in two.
    <main
      className="flex min-h-screen items-center justify-center p-4 sm:p-8"
      style={{
        background:
          'radial-gradient(120% 90% at 8% 4%, rgba(58,174,160,0.13) 0%, rgba(58,174,160,0) 46%), radial-gradient(110% 85% at 96% 92%, rgba(245,237,224,0.85) 0%, rgba(245,237,224,0) 52%), linear-gradient(168deg, #fdfcfa 0%, #f3f7f8 100%)',
      }}
    >
      <SessionRestore />

      {/* One card holds photo + form — the frame that ties them together */}
      <div
        className="w-full max-w-[980px] overflow-hidden rounded-[28px] bg-white sm:rounded-[32px] lg:grid lg:grid-cols-[0.88fr_1fr]"
        style={{
          border: '1px solid rgba(58,174,160,0.20)',
          boxShadow:
            '0 30px 70px rgba(13,47,66,0.16), 0 2px 8px rgba(13,47,66,0.06)',
        }}
      >
        {/* Photo panel. Sized so the source (2000×1333) is never upscaled:
            a short banner on phones, a tall panel beside the form on desktop. */}
        <section className="relative h-[168px] w-full overflow-hidden sm:h-[200px] lg:h-auto lg:min-h-[560px]">
          <Image
            src="/brand/hwc-hero.jpg"
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 460px, 100vw"
            className="object-cover"
            style={{ objectPosition: '52% 60%', filter: 'saturate(1.1) contrast(1.03)' }}
          />
          {/* Ocean wash. Two versions: the heavy foot only exists on desktop,
              where the strapline needs contrast — on phones there's no text
              over the photo, so a dark band there would just look muddy. */}
          <div
            className="absolute inset-0 lg:hidden"
            style={{
              background:
                'linear-gradient(to bottom, rgba(13,47,66,0.26) 0%, rgba(13,47,66,0.02) 55%, rgba(13,47,66,0.12) 100%)',
            }}
          />
          <div
            className="absolute inset-0 hidden lg:block"
            style={{
              background:
                'linear-gradient(to bottom, rgba(13,47,66,0.34) 0%, rgba(13,47,66,0.04) 42%, rgba(13,47,66,0.55) 82%, rgba(13,47,66,0.80) 100%)',
            }}
          />
          {/* Strapline — desktop only, in normal flow at the bottom of the
              panel so a long line wraps instead of running off the edge. */}
          <div className="absolute inset-x-0 bottom-0 hidden p-8 lg:block">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/75">
              Hawaii Wellness Clinic
            </p>
            <p className="hwc-display mt-2 text-[1.6rem] leading-[1.25] text-white">
              Advanced therapies for
              <br />
              mind and body
            </p>
          </div>
        </section>

        {/* Form panel */}
        <section className="hwc-form px-6 py-9 sm:px-10 sm:py-11 lg:flex lg:items-center lg:px-12">
          <div className="mx-auto w-full max-w-[360px]">
            <div className="cm-rise flex justify-center lg:justify-start">
              <Image
                src="/brand/hwc-logo.png"
                alt="Hawaii Wellness Clinic"
                width={1466}
                height={553}
                priority
                sizes="200px"
                className="h-auto w-[200px]"
              />
            </div>

            <h1
              className="hwc-display cm-rise mt-7 text-center text-[1.9rem] leading-[1.15] lg:text-left"
              style={{ animationDelay: '60ms', color: 'var(--hwc-ocean-dark)' }}
            >
              Sign in to your workspace
            </h1>
            <p
              className="cm-rise mt-2.5 text-center text-[14px] font-light leading-relaxed lg:text-left"
              style={{ animationDelay: '120ms', color: '#5a7a6a' }}
            >
              Enter your team code, or open the install link your clinic sent you.
            </p>

            <div className="cm-rise mt-7 flex flex-col gap-5" style={{ animationDelay: '180ms' }}>
              {errorMsg && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errorMsg}
                </div>
              )}
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

            <p
              className="cm-rise mt-7 text-center text-[11px] lg:text-left"
              style={{ animationDelay: '260ms', color: '#8aa398' }}
            >
              Can&apos;t sign in? Ask your clinic for a fresh install link.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
