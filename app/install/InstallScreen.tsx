import Image from 'next/image'
import Link from 'next/link'
import { PWAInstallCard } from '@/app/dashboard/components/PWAInstallCard'

/**
 * First screen a doctor lands on after opening their install link.
 * Branded to Hawaii Wellness Clinic: real logo asset, the clinic's own
 * Hawaii photography, Playfair Display + Inter, ocean/teal palette — all
 * lifted from HWC-Landing-pages so the app and the site read as one brand.
 */
export function InstallScreen({ clinicId }: { clinicId: string }) {
  return (
    <>
      {/* Hero — photography, with text kept off it so every glyph stays sharp */}
      <section className="relative h-[34vh] min-h-[200px] w-full overflow-hidden">
        <Image
          src="/brand/hwc-hero.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
          style={{ objectPosition: '50% 62%' }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgba(13,47,66,0.34) 0%, rgba(13,47,66,0.06) 55%, rgba(13,47,66,0.14) 100%)',
          }}
        />
      </section>

      {/* White sheet lifted over the photo edge. The logo lives inside it,
          never on the photograph — that's what keeps the wordmark legible. */}
      <section
        className="relative z-10 -mt-7 rounded-t-[28px] bg-white px-5 pb-16 pt-8"
        style={{ boxShadow: '0 -8px 28px rgba(13,47,66,0.10)' }}
      >
        <div className="mx-auto flex w-full max-w-sm flex-col gap-7">
          {/* The real logo file, never a redrawn one. Rendered at its natural
              aspect with no scaling transform — that's what keeps it crisp. */}
          <div className="cm-rise flex justify-center">
            <Image
              src="/brand/hwc-logo.png"
              alt="Hawaii Wellness Clinic"
              width={1466}
              height={553}
              priority
              sizes="240px"
              className="h-auto w-[240px]"
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
              className="hwc-display cm-rise text-[2rem] leading-[1.15]"
              style={{ animationDelay: '120ms', color: 'var(--hwc-ocean-dark)' }}
            >
              Add the studio to
              <br />
              your home screen
            </h1>

            <p
              className="cm-rise max-w-[19rem] text-[0.95rem] font-light leading-relaxed"
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
            className="cm-rise text-center text-xs"
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
    </>
  )
}
