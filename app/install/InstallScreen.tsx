import Image from 'next/image'
import Link from 'next/link'
import { PWAInstallCard } from '@/app/dashboard/components/PWAInstallCard'

/**
 * First screen a doctor lands on after opening their install link.
 * Same frame as the sign-in door: one card carrying the clinic's photography
 * and content, sitting on a tinted ground. Brand assets and palette come from
 * HWC-Landing-pages so the app and the clinic's site read as one system.
 */
export function InstallScreen({ clinicId }: { clinicId: string }) {
  return (
    <div
      className="w-full max-w-[520px] overflow-hidden rounded-[28px] bg-white sm:rounded-[32px]"
      style={{
        border: '1px solid rgba(58,174,160,0.20)',
        boxShadow: '0 30px 70px rgba(13,47,66,0.16), 0 2px 8px rgba(13,47,66,0.06)',
      }}
    >
      {/* Photo banner — kept short so the 2000px source is never upscaled */}
      <section className="relative h-[168px] w-full overflow-hidden sm:h-[200px]">
        <Image
          src="/brand/hwc-hero.jpg"
          alt=""
          fill
          priority
          sizes="(min-width: 640px) 520px, 100vw"
          className="object-cover"
          style={{ objectPosition: '52% 60%', filter: 'saturate(1.1) contrast(1.03)' }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgba(13,47,66,0.26) 0%, rgba(13,47,66,0.02) 55%, rgba(13,47,66,0.12) 100%)',
          }}
        />
      </section>

      <section className="px-6 py-9 sm:px-10 sm:py-11">
        <div className="mx-auto flex w-full max-w-[360px] flex-col gap-7">
          {/* The real logo file, on white so the wordmark stays crisp */}
          <div className="cm-rise flex justify-center">
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

          <div className="flex flex-col items-center gap-3 text-center">
            <span
              className="cm-rise inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]"
              style={{
                animationDelay: '60ms',
                color: 'var(--hwc-teal)',
                background: 'rgba(58,174,160,0.10)',
                border: '1px solid rgba(58,174,160,0.22)',
              }}
            >
              Content Studio
            </span>

            <h1
              className="hwc-display cm-rise text-[1.9rem] leading-[1.15]"
              style={{ animationDelay: '120ms', color: 'var(--hwc-ocean-dark)' }}
            >
              Add the studio to
              <br />
              your home screen
            </h1>

            <p
              className="cm-rise max-w-[19rem] text-[14px] font-light leading-relaxed"
              style={{ animationDelay: '180ms', color: '#5a7a6a' }}
            >
              Scripts, teleprompter and recording — installed once, opens like
              any other app on your phone.
            </p>
          </div>

          {/* Hairline rule in the clinic's teal — the landings' divider motif */}
          <div
            className="cm-rise mx-auto h-px w-16"
            style={{ animationDelay: '220ms', background: 'rgba(58,174,160,0.35)' }}
          />

          <div className="cm-rise" style={{ animationDelay: '260ms' }}>
            <PWAInstallCard clinicId={clinicId} isAdmin={false} />
          </div>

          <p
            className="cm-rise text-center text-[11px]"
            style={{ animationDelay: '320ms', color: '#8aa398' }}
          >
            Already installed?{' '}
            <Link
              href="/dashboard"
              className="font-medium hover:underline"
              style={{ color: 'var(--hwc-ocean-light)' }}
            >
              Go to dashboard →
            </Link>
          </p>
        </div>
      </section>
    </div>
  )
}
