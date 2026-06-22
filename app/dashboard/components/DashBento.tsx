import Link from 'next/link'
import { Meteors } from '@/app/components/ui/meteors'

const GLASS_CARD = {
  background: 'rgba(255,255,255,0.52)',
  backdropFilter: 'blur(24px) saturate(1.8)',
  WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
  border: '1px solid rgba(255,255,255,0.70)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 1px 0 rgba(255,255,255,0.95) inset',
} as const

interface CardProps {
  title: string
  desc: string
  href: string
  tag: string
  tagColor: string
  iconBg: string
  icon: React.ReactNode
  tall?: boolean
  meteors?: boolean
}

function Card({ title, desc, href, tag, tagColor, iconBg, icon, tall, meteors }: CardProps) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-0.5 hover:border-white/12"
      style={{ ...GLASS_CARD, minHeight: tall ? 200 : 160 }}
    >
      {/* Meteors decoration */}
      {meteors && <Meteors number={10} color={tagColor} />}

      {/* Subtle gradient tint on hover */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `radial-gradient(ellipse at 30% 0%, ${tagColor}14 0%, transparent 65%)` }} />

      <div className="relative flex flex-1 flex-col justify-between p-5">
        {/* Top row: icon + status tag */}
        <div className="flex items-start justify-between">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: iconBg, boxShadow: `0 4px 12px ${tagColor}30` }}
          >
            {icon}
          </div>
          <span
            className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]"
            style={{ background: `${tagColor}18`, color: tagColor, border: `1px solid ${tagColor}30` }}
          >
            {tag}
          </span>
        </div>

        {/* Bottom: text */}
        <div className="mt-4">
          <h3 className="text-[15px] font-semibold tracking-tight text-neutral-900">{title}</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">{desc}</p>
        </div>
      </div>

      {/* Hover arrow */}
      <div className="absolute bottom-5 right-5 translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-900 text-white shadow-sm">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </div>
      </div>
    </Link>
  )
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────

const IconPen = () => (
  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
  </svg>
)
const IconStack = () => (
  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3" />
  </svg>
)
const IconPalette = () => (
  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
  </svg>
)
const IconCamera = () => (
  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9A2.25 2.25 0 0013.5 5.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25Z" />
  </svg>
)
const IconShield = () => (
  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
)

// ── Export ────────────────────────────────────────────────────────────────────

export function DashBento({ clinicId, isAdmin }: { clinicId: string; isAdmin: boolean }) {
  const q = `clinicId=${clinicId}`

  const allCards = [
    {
      title: 'Script Library',
      desc: 'Proven hooks and structures',
      href: `/arsenal?${q}`,
      tag: 'Templates',
      tagColor: '#a78bfa',
      iconBg: 'linear-gradient(135deg,#8b5cf6,#7c3aed)',
      icon: <IconStack />,
      meteors: true,
      adminOnly: false,
    },
    {
      title: 'Visual Posts',
      desc: 'Scripts → Canva slides',
      href: `/visual?${q}`,
      tag: 'Canva',
      tagColor: '#2dd4bf',
      iconBg: 'linear-gradient(135deg,#14b8a6,#0d9488)',
      icon: <IconPalette />,
      adminOnly: true,
    },
    {
      title: 'Studio',
      desc: 'TikTok trends to shot list',
      href: `/studio?${q}`,
      tag: 'Film',
      tagColor: '#38bdf8',
      iconBg: 'linear-gradient(135deg,#38bdf8,#0ea5e9)',
      icon: <IconCamera />,
      adminOnly: true,
    },
    {
      title: 'Compliance',
      desc: 'FDA / FTC — every post scored',
      href: '/compliance',
      tag: 'FDA/FTC',
      tagColor: '#fbbf24',
      iconBg: 'linear-gradient(135deg,#f59e0b,#d97706)',
      icon: <IconShield />,
      adminOnly: false,
    },
  ]

  const cards = allCards.filter(c => !c.adminOnly || isAdmin)

  return (
    <>
      {/* Mobile: horizontal scroll strip */}
      <div className="flex gap-3 overflow-x-auto pb-1 sm:hidden" style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>
        {cards.map((card, i) => (
          <div key={i} className="w-[160px] shrink-0" style={{ scrollSnapAlign: 'start' }}>
            <Card {...card} />
          </div>
        ))}
      </div>
      {/* Desktop: 2-column grid */}
      <div className="hidden sm:grid sm:grid-cols-2 sm:gap-3">
        <Card {...cards[0]} tall />
        <Card {...cards[1]} tall />
        <Card {...cards[2]} />
        <Card {...cards[3]} />
      </div>
    </>
  )
}
