import { redirect } from 'next/navigation'
import Link from 'next/link'
import { resolveAccess } from '@/lib/auth/session'
import { DEFAULT_VISUAL_STYLE } from '@/lib/visual/store'
import { buildSlideHTML } from '@/lib/visual/templates'
import type { TypedSlide, VisualStyle } from '@/types'

export const dynamic = 'force-dynamic'

// ─── Sample inputs that mirror the two Canva references in /refs/canva ──

const SAMPLE_PHOTO_BODY =
  'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=1080&q=80'
const SAMPLE_PHOTO_CTA =
  'https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=1080&q=80'

const TMS_SLIDES: TypedSlide[] = [
  {
    kind: 'cover',
    text: 'HOW MAGNETIC\nFIELDS CHANGE\nDEPRESSION',
    chip: 'TMS THERAPY',
    subtext: 'A non-invasive, FDA-cleared treatment',
  },
  {
    kind: 'body',
    chip: 'WHAT TMS IS',
    text: 'TMS (TRANSCRANIAL MAGNETIC STIMULATION) IS A NON-INVASIVE PROCEDURE. A MAGNETIC COIL PLACED NEAR THE SCALP DELIVERS FOCUSED ELECTROMAGNETIC PULSES TO SPECIFIC REGIONS OF THE BRAIN.',
    subtext: null,
  },
  {
    kind: 'cta',
    chip: 'STILL HAVE QUESTIONS?',
    subtext: 'OUR TEAM HAS HELPED 1,200+ PATIENTS',
    text: 'BOOK A CONSULTATION — LINK IN BIO',
  },
]

const ED_SLIDES: TypedSlide[] = [
  {
    kind: 'cover',
    text: 'Erectile Dysfunction',
    chip: '',
    subtext: "What men don't discuss with their doctor",
  },
  {
    kind: 'body',
    chip: 'The real cause',
    text: 'Most people assume ED is primarily psychological. The data says otherwise — vascular health is the leading driver in men over 40.',
    subtext: null,
  },
  {
    kind: 'cta',
    chip: 'Book a confidential consult',
    subtext: 'No referral needed. Same-week appointments.',
    text: 'Link in bio →',
  },
]

const CLASSIC_STYLE: VisualStyle = {
  ...DEFAULT_VISUAL_STYLE,
  template_variant: 'classic',
}

const WAVE_STYLE: VisualStyle = {
  ...DEFAULT_VISUAL_STYLE,
  template_variant: 'wave',
}

const PHOTOS: Record<string, string | null> = {
  cover: null,
  body: SAMPLE_PHOTO_BODY,
  cta: SAMPLE_PHOTO_CTA,
}

interface SlidePreviewProps {
  slide: TypedSlide
  style: VisualStyle
  label: string
}

function SlidePreview({ slide, style, label }: SlidePreviewProps) {
  const html = buildSlideHTML(slide, PHOTOS[slide.kind] ?? null, style)
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500">
        {label}
      </p>
      <div className="overflow-hidden rounded-lg border border-neutral-200 shadow-sm">
        <iframe
          srcDoc={html}
          // Native 1080×1350 → display at 360×450 (1/3 scale).
          style={{
            width: 1080,
            height: 1350,
            transform: 'scale(0.3333)',
            transformOrigin: 'top left',
            border: 'none',
            display: 'block',
          }}
          width={360}
          height={450}
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  )
}

function ReferenceImage({ src, label }: { src: string; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-600">
        {label}
      </p>
      <div className="overflow-hidden rounded-lg border border-emerald-300 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={label}
          className="block h-auto w-[360px] object-contain"
        />
      </div>
    </div>
  )
}

export default async function VisualComparePage() {
  const access = await resolveAccess()
  if (!access) redirect('/')
  if (access.role !== 'admin') redirect('/dashboard')

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-5 py-6 sm:px-6 sm:py-8">
      <header className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-sky-500">
            Visual self-check
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-neutral-900">
            Template comparison
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-600">
            Current Puppeteer renders (left) next to Canva references (right).
            Two style families: <strong>classic</strong> (HWC navy + uppercase)
            and <strong>wave</strong> (mixed-case + curved card overlay).
            Edit{' '}
            <code className="rounded bg-neutral-100 px-1 py-0.5 text-[11px]">
              lib/visual/templates.ts
            </code>{' '}
            and refresh — no API call.
          </p>
        </div>
        <Link href="/visual" className="cm-btn cm-btn-ghost text-sm">
          ← Visual
        </Link>
      </header>

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">
            Style 1 — classic (TMS)
          </h2>
          <span className="text-xs text-neutral-500">
            ref: <code>DAHKMvQjpc4</code>
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-700">
              Current render
            </p>
            <div className="grid grid-cols-3 gap-3">
              {TMS_SLIDES.map((s, i) => (
                <SlidePreview
                  key={`classic-${i}`}
                  slide={s}
                  style={CLASSIC_STYLE}
                  label={s.kind}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
              Canva reference
            </p>
            <div className="grid grid-cols-1 gap-2">
              <ReferenceImage
                src="/refs/canva/canva-style-1-TMS.png"
                label="slides 1-2"
              />
              <ReferenceImage
                src="/refs/canva/canva-style-1-all.png"
                label="slides 1-2 (wide capture)"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">
            Style 2 — wave (ED)
          </h2>
          <span className="text-xs text-neutral-500">
            ref: <code>DAHK2poX3PY</code>
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-700">
              Current render
            </p>
            <div className="grid grid-cols-3 gap-3">
              {ED_SLIDES.map((s, i) => (
                <SlidePreview
                  key={`wave-${i}`}
                  slide={s}
                  style={WAVE_STYLE}
                  label={s.kind}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
              Canva reference
            </p>
            <div className="grid grid-cols-1 gap-2">
              <ReferenceImage
                src="/refs/canva/canva-style-2-all.png"
                label="slides 1-2"
              />
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-neutral-200 pt-4 text-xs text-neutral-500">
        Admin-only • styles live in{' '}
        <code className="rounded bg-neutral-100 px-1 py-0.5">
          lib/visual/templates.ts
        </code>{' '}
        • references in{' '}
        <code className="rounded bg-neutral-100 px-1 py-0.5">
          public/refs/canva/
        </code>
      </footer>
    </main>
  )
}
