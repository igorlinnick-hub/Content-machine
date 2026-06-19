import Link from 'next/link'

interface BentoCardProps {
  name: string
  className: string
  background: React.ReactNode
  icon: React.ReactNode
  description: string
  href: string
  cta: string
  badge?: string
  badgeColor?: string
}

function BentoCard({
  name,
  className,
  background,
  icon,
  description,
  href,
  cta,
  badge,
  badgeColor = 'bg-sky-100 text-sky-700',
}: BentoCardProps) {
  return (
    <div
      className={[
        'group relative col-span-3 flex flex-col justify-between overflow-hidden rounded-2xl',
        'bg-white border border-neutral-200/70',
        'shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.06)]',
        'transition-all duration-300 hover:shadow-[0_4px_24px_rgba(0,0,0,0.12)] hover:-translate-y-0.5',
        className,
      ].join(' ')}
    >
      {/* Animated background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {background}
      </div>

      {/* Hover overlay */}
      <div className="pointer-events-none absolute inset-0 transition-colors duration-300 group-hover:bg-black/[0.02]" />

      {/* Bottom content */}
      <div className="relative z-10 mt-auto p-5 sm:p-6">
        <div className="pointer-events-none flex transform-gpu flex-col gap-1 transition-all duration-300 group-hover:-translate-y-8">
          {/* Icon + badge row */}
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-900 text-white shadow-sm">
              {icon}
            </div>
            {badge && (
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${badgeColor}`}>
                {badge}
              </span>
            )}
          </div>
          <h3 className="mt-2.5 text-lg font-semibold text-neutral-900">{name}</h3>
          <p className="max-w-xs text-sm text-neutral-500">{description}</p>
        </div>

        {/* Hover-reveal CTA */}
        <div className="pointer-events-none absolute bottom-5 left-5 right-5 translate-y-6 opacity-0 transition-all duration-300 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 sm:bottom-6 sm:left-6 sm:right-6">
          <Link
            href={href}
            className="inline-flex items-center gap-1.5 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700"
          >
            {cta}
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  )
}

// ── Backgrounds ───────────────────────────────────────────────────────────────

function ScriptsBg() {
  return (
    <div className="absolute inset-0 flex flex-col gap-2.5 p-5 pt-4 opacity-[0.18] transition-opacity duration-300 group-hover:opacity-[0.26]">
      {['Regenerative peptide therapy: what the science says',
        'Why IV NAD+ is the fastest path to cellular recovery',
        'Patient story: 6 months of hormone optimization',
        'The truth about testosterone and cardiovascular health',
        'Top 5 biomarkers every patient should track',
        'What happens to your stem cells after 40',
      ].map((line, i) => (
        <div
          key={i}
          className="h-5 rounded-full bg-neutral-900"
          style={{
            width: `${55 + (i % 3) * 14}%`,
            animationDelay: `${i * 140}ms`,
          }}
        />
      ))}
    </div>
  )
}

function LibraryBg() {
  const cards = ['IV Protocol guide', 'Peptide FAQ', 'Testosterone basics', 'Stem cell intro']
  return (
    <div className="absolute right-3 top-3 flex flex-col gap-2 opacity-20 transition-opacity duration-300 group-hover:opacity-30" style={{ transform: 'rotate(3deg)' }}>
      {cards.map((t, i) => (
        <div key={i} className="rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-1.5">
          <div className="text-[10px] font-medium text-neutral-700">{t}</div>
        </div>
      ))}
    </div>
  )
}

function VisualBg() {
  const colors = [
    '#0ea5e9', '#0284c7', '#0369a1',
    '#14b8a6', '#0d9488', '#0f766e',
    '#f59e0b', '#d97706', '#b45309',
  ]
  return (
    <div className="absolute right-4 top-4 grid grid-cols-3 gap-1.5 opacity-25 transition-opacity duration-300 group-hover:opacity-40" style={{ transform: 'rotate(-4deg)' }}>
      {colors.map((c, i) => (
        <div key={i} className="h-8 w-8 rounded-lg shadow-sm" style={{ backgroundColor: c }} />
      ))}
    </div>
  )
}

function StudioBg() {
  return (
    <div className="absolute right-6 top-4 opacity-15 transition-opacity duration-300 group-hover:opacity-25">
      <div className="relative flex h-20 w-20 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full border border-sky-400 opacity-40" style={{ animationDuration: '2.4s' }} />
        <div className="absolute inset-3 rounded-full border border-sky-400 opacity-60" />
        <svg className="h-8 w-8 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
        </svg>
      </div>
    </div>
  )
}

function ComplianceBg() {
  const items = ['No outcome claims', 'FDA terms only', 'Patient testimonials OK', 'No "cure" language']
  return (
    <div className="absolute right-3 top-3 flex flex-col gap-1.5 opacity-20 transition-opacity duration-300 group-hover:opacity-30">
      {items.map((t, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-400">
            <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <span className="text-[10px] font-medium text-neutral-700">{t}</span>
        </div>
      ))}
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const IconPen = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
  </svg>
)
const IconStack = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6.878V6a2.25 2.25 0 012.25-2.25h7.5A2.25 2.25 0 0118 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 004.5 9v.878m13.5-3A2.25 2.25 0 0119.5 9v.878m0 0a2.246 2.246 0 00-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0121 12v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6a2.25 2.25 0 012.25-2.25" />
  </svg>
)
const IconPalette = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
  </svg>
)
const IconCamera = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
  </svg>
)
const IconShield = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
)

// ── Main component ────────────────────────────────────────────────────────────

interface DashBentoProps {
  clinicId: string
  isAdmin: boolean
}

export function DashBento({ clinicId, isAdmin }: DashBentoProps) {
  const q = `clinicId=${clinicId}`

  const cards: BentoCardProps[] = [
    {
      name: 'Script Generator',
      description: "AI-powered posts from your doctor's notes. 5-agent pipeline: research → write → critique → finalize.",
      href: `/dashboard?${q}&tab=generate`,
      cta: 'Write scripts',
      className: 'lg:col-span-2 min-h-[15rem]',
      badge: 'AI',
      badgeColor: 'bg-sky-100 text-sky-700',
      icon: <IconPen />,
      background: <ScriptsBg />,
    },
    {
      name: 'Script Library',
      description: 'Proven hooks, angles, and structures you can reuse.',
      href: `/arsenal?${q}`,
      cta: 'Browse library',
      className: 'lg:col-span-1 min-h-[15rem]',
      badge: `Templates`,
      badgeColor: 'bg-violet-100 text-violet-700',
      icon: <IconStack />,
      background: <LibraryBg />,
    },
    {
      name: 'Visual Posts',
      description: 'Turn scripts into Canva slide decks — auto-branded, ready to post.',
      href: `/visual?${q}`,
      cta: 'Open Canva',
      className: 'lg:col-span-1 min-h-[12rem]',
      badge: 'Canva',
      badgeColor: 'bg-teal-100 text-teal-700',
      icon: <IconPalette />,
      background: <VisualBg />,
    },
    {
      name: 'Studio',
      description: 'Film planning from TikTok trends to your shot list.',
      href: `/studio?${q}`,
      cta: 'Plan shots',
      className: 'lg:col-span-1 min-h-[12rem]',
      badge: 'Filming',
      badgeColor: 'bg-sky-100 text-sky-700',
      icon: <IconCamera />,
      background: <StudioBg />,
    },
    {
      name: 'Compliance',
      description: 'Every post scored against FDA / FTC rules before it reaches Canva.',
      href: `/compliance`,
      cta: 'Read ruleset',
      className: 'lg:col-span-1 min-h-[12rem]',
      badge: 'FDA/FTC',
      badgeColor: 'bg-amber-100 text-amber-700',
      icon: <IconShield />,
      background: <ComplianceBg />,
    },
  ]

  if (!isAdmin) {
    // Doctors only see Scripts + Library
    return (
      <div className="grid w-full auto-rows-[14rem] grid-cols-3 gap-3 sm:gap-4">
        <BentoCard {...cards[0]} />
        <BentoCard {...cards[1]} />
      </div>
    )
  }

  return (
    <div className="grid w-full grid-cols-3 gap-3 sm:gap-4">
      {/* Row 1 */}
      <BentoCard {...cards[0]} />
      <BentoCard {...cards[1]} />
      {/* Row 2 */}
      <BentoCard {...cards[2]} />
      <BentoCard {...cards[3]} />
      <BentoCard {...cards[4]} />
    </div>
  )
}
