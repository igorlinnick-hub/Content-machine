import Link from 'next/link'

interface CardProps {
  title: string
  desc: string
  href: string
  label: string
  labelColor: string
  accent: string   // tailwind bg color for icon bg
  icon: React.ReactNode
  bg: React.ReactNode
  span?: string    // col-span class
}

function Card({ title, desc, href, label, labelColor, accent, icon, bg, span = '' }: CardProps) {
  return (
    <Link
      href={href}
      className={[
        'group relative flex flex-col justify-end overflow-hidden rounded-2xl bg-white',
        'border border-neutral-100 shadow-[0_1px_4px_rgba(0,0,0,0.05),0_4px_16px_rgba(0,0,0,0.04)]',
        'transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(0,0,0,0.10)]',
        'p-5 cursor-pointer',
        span,
      ].join(' ')}
    >
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0">{bg}</div>

      {/* Content */}
      <div className="relative z-10 flex flex-col gap-2">
        <div className="flex items-end justify-between">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${accent} text-white shadow-sm`}>
            {icon}
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${labelColor}`}>
            {label}
          </span>
        </div>
        <div>
          <h3 className="text-[15px] font-semibold leading-tight text-neutral-900">{title}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-neutral-400">{desc}</p>
        </div>
      </div>

      {/* Hover arrow */}
      <div className="pointer-events-none absolute right-4 top-4 translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100">
        <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
      </div>
    </Link>
  )
}

// ── Lightweight decorative backgrounds ────────────────────────────────────────

const ScriptsBg = () => (
  <div className="absolute inset-0 flex flex-col justify-end gap-1.5 overflow-hidden p-5 pb-[4.5rem]">
    {[72, 88, 60, 80, 50, 68].map((w, i) => (
      <div
        key={i}
        className="h-1.5 rounded-full bg-sky-100"
        style={{ width: `${w}%` }}
      />
    ))}
  </div>
)

const LibraryBg = () => (
  <div
    className="absolute right-4 top-4 flex flex-col gap-1.5 opacity-60"
    style={{ transform: 'rotate(4deg)' }}
  >
    {['IV Protocol', 'Peptide FAQ', 'Hormones 101', 'Stem cells'].map((t, i) => (
      <div key={i} className="rounded-lg border border-neutral-100 bg-neutral-50 px-2.5 py-1">
        <span className="text-[10px] font-medium text-neutral-400">{t}</span>
      </div>
    ))}
  </div>
)

const VisualBg = () => (
  <div
    className="absolute right-3 top-3 grid grid-cols-3 gap-1 opacity-70"
    style={{ transform: 'rotate(-3deg)' }}
  >
    {['#bae6fd','#7dd3fc','#38bdf8','#99f6e4','#5eead4','#2dd4bf','#fde68a','#fcd34d','#fbbf24'].map((c, i) => (
      <div key={i} className="h-7 w-7 rounded-lg" style={{ backgroundColor: c }} />
    ))}
  </div>
)

const StudioBg = () => (
  <div className="absolute right-4 top-3 flex items-center justify-center opacity-50">
    <div className="relative h-14 w-14">
      <div className="absolute inset-0 animate-ping rounded-full border border-sky-300" style={{ animationDuration: '2.5s' }} />
      <div className="absolute inset-2 rounded-full border border-sky-200" />
      <div className="absolute inset-0 flex items-center justify-center">
        <svg className="h-5 w-5 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9A2.25 2.25 0 0 0 13.5 5.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
        </svg>
      </div>
    </div>
  </div>
)

const ComplianceBg = () => (
  <div className="absolute right-3 top-3 flex flex-col gap-1.5 opacity-55">
    {['No outcome claims', 'FDA terms only', 'No "cure" language'].map((t, i) => (
      <div key={i} className="flex items-center gap-1.5">
        <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-200">
          <svg className="h-2 w-2 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <span className="text-[9px] font-medium text-neutral-400">{t}</span>
      </div>
    ))}
  </div>
)

// ── Icons ─────────────────────────────────────────────────────────────────────

const IconPen = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
  </svg>
)
const IconStack = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6.878V6a2.25 2.25 0 012.25-2.25h7.5A2.25 2.25 0 0118 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 004.5 9v.878m13.5-3A2.25 2.25 0 0119.5 9v.878m0 0a2.246 2.246 0 00-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0121 12v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6a2.25 2.25 0 012.25-2.25" />
  </svg>
)
const IconPalette = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
  </svg>
)
const IconCamera = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9A2.25 2.25 0 0 0 13.5 5.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
  </svg>
)
const IconShield = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
)

// ── Main export ───────────────────────────────────────────────────────────────

interface DashBentoProps {
  clinicId: string
  isAdmin: boolean
}

export function DashBento({ clinicId, isAdmin }: DashBentoProps) {
  const q = `clinicId=${clinicId}`

  if (!isAdmin) {
    return (
      <div className="grid grid-cols-2 gap-3" style={{ gridAutoRows: '160px' }}>
        <Card
          title="Script Generator"
          desc="AI posts from doctor notes"
          href={`/dashboard?${q}&tab=generate`}
          label="AI"
          labelColor="bg-sky-50 text-sky-600"
          accent="bg-neutral-900"
          icon={<IconPen />}
          bg={<ScriptsBg />}
        />
        <Card
          title="Script Library"
          desc="Templates & proven hooks"
          href={`/arsenal?${q}`}
          label="Templates"
          labelColor="bg-violet-50 text-violet-600"
          accent="bg-neutral-900"
          icon={<IconStack />}
          bg={<LibraryBg />}
        />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {/* Row 1 — tall */}
      <Card
        title="Script Generator"
        desc="5-agent AI pipeline — research, write, critique, finalize"
        href={`/dashboard?${q}&tab=generate`}
        label="AI"
        labelColor="bg-sky-50 text-sky-600"
        accent="bg-neutral-900"
        icon={<IconPen />}
        bg={<ScriptsBg />}
        span="col-span-2"
      />
      <Card
        title="Script Library"
        desc="Proven hooks and structures to reuse"
        href={`/arsenal?${q}`}
        label="Templates"
        labelColor="bg-violet-50 text-violet-600"
        accent="bg-neutral-900"
        icon={<IconStack />}
        bg={<LibraryBg />}
      />
      {/* Row 2 — shorter */}
      <Card
        title="Visual Posts"
        desc="Scripts → Canva slide decks"
        href={`/visual?${q}`}
        label="Canva"
        labelColor="bg-teal-50 text-teal-600"
        accent="bg-teal-600"
        icon={<IconPalette />}
        bg={<VisualBg />}
      />
      <Card
        title="Studio"
        desc="TikTok trends to shot list"
        href={`/studio?${q}`}
        label="Film"
        labelColor="bg-sky-50 text-sky-600"
        accent="bg-sky-600"
        icon={<IconCamera />}
        bg={<StudioBg />}
      />
      <Card
        title="Compliance"
        desc="FDA / FTC rules, every post scored"
        href="/compliance"
        label="FDA/FTC"
        labelColor="bg-amber-50 text-amber-600"
        accent="bg-amber-500"
        icon={<IconShield />}
        bg={<ComplianceBg />}
      />
    </div>
  )
}
