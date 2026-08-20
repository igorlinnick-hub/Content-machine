'use client'

import { useState } from 'react'
import type { ShootCard } from '@/lib/studio/schedule'

// The MA's screen. Phone-first: they hold this in one hand while filming,
// so the player and the steps have to sit above the fold and nothing may
// require typing, logging in, or downloading.

const GLASS = {
  background: 'rgba(255,255,255,0.7)',
  border: '1px solid rgba(255,255,255,0.85)',
  boxShadow: '0 2px 16px rgba(0,0,0,0.05)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
} as const

// Dates arrive as plain YYYY-MM-DD. Parsing them with `new Date(iso)` would
// read them as UTC midnight and render the previous day west of Greenwich,
// so the parts are split by hand.
function fmtDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

function dayLabel(iso: string, today: string): string {
  if (iso === today) return 'Today'
  const [y, m, d] = today.split('-').map(Number)
  const t = new Date(y, m - 1, d)
  t.setDate(t.getDate() + 1)
  const tomorrow = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(
    t.getDate()
  ).padStart(2, '0')}`
  return iso === tomorrow ? 'Tomorrow' : fmtDay(iso)
}

function Player({ card }: { card: ShootCard }) {
  // Embeds (Instagram / YouTube) render their own chrome and caption, so
  // they get a tall fixed box and scroll internally. Our own uploads get a
  // plain player.
  if (card.embed_url) {
    return (
      <div className="overflow-hidden rounded-2xl bg-black/5">
        <iframe
          src={card.embed_url}
          className="h-[620px] w-full border-0"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
          allowFullScreen
          loading="lazy"
          title={card.title ?? 'Reference video'}
        />
      </div>
    )
  }
  if (card.video_url) {
    return (
      <video
        src={card.video_url}
        poster={card.thumbnail_url ?? undefined}
        controls
        playsInline
        className="max-h-[620px] w-full rounded-2xl bg-black object-contain"
      />
    )
  }
  return (
    <div className="flex h-40 items-center justify-center rounded-2xl bg-neutral-100 text-sm text-neutral-500">
      No reference video — follow the steps below.
    </div>
  )
}

function Card({ card, today }: { card: ShootCard; today: string }) {
  const isToday = card.shoot_date === today
  return (
    <section
      className="rounded-3xl p-4 sm:p-6"
      style={GLASS}
      id={`day-${card.shoot_date}`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            isToday ? 'bg-violet-600 text-white' : 'bg-neutral-200 text-neutral-700'
          }`}
        >
          {dayLabel(card.shoot_date, today)}
        </span>
        {!isToday && (
          <span className="text-xs text-neutral-500">{fmtDay(card.shoot_date)}</span>
        )}
        {card.account && (
          <span className="text-xs text-neutral-500">{card.account}</span>
        )}
      </div>

      <h2 className="mb-1 text-lg font-semibold text-neutral-900">
        {card.topic || card.title || 'Shoot'}
      </h2>
      {card.style_description && (
        <p className="mb-4 text-sm leading-relaxed text-neutral-600">
          {card.style_description}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div>
          <Player card={card} />
          {card.source_url && (
            <a
              href={card.source_url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-xs text-neutral-500 underline"
            >
              Open the original
            </a>
          )}
        </div>

        <div className="flex flex-col gap-5">
          {card.steps.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                How to shoot it
              </h3>
              <ol className="flex flex-col gap-2">
                {card.steps.map((s, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed text-neutral-800">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[11px] font-semibold text-violet-700">
                      {i + 1}
                    </span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {card.script_lines.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                What to say
              </h3>
              <div className="flex flex-col gap-2">
                {card.script_lines.map((l, i) => (
                  <p key={i} className="text-sm leading-relaxed text-neutral-800">
                    {l}
                  </p>
                ))}
              </div>
            </div>
          )}

          {card.steps.length === 0 && card.script_lines.length === 0 && (
            <p className="text-sm text-neutral-500">
              Watch the reference and film the same format with our own topic.
            </p>
          )}

          {card.beats.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Format breakdown
              </summary>
              <ul className="mt-2 flex flex-col gap-1.5">
                {card.beats.map((b, i) => (
                  <li key={i} className="text-sm text-neutral-700">
                    <span className="font-medium">{b.name}</span> — {b.text}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>
    </section>
  )
}

export default function ShootBoard({
  clinicName,
  cards,
  today,
}: {
  clinicName: string
  cards: ShootCard[]
  today: string
}) {
  const [showAll, setShowAll] = useState(false)
  const todayCard = cards.find((c) => c.shoot_date === today) ?? null
  const upcoming = cards.filter((c) => c.shoot_date > today)
  const visible = showAll ? upcoming : upcoming.slice(0, 3)

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
          {clinicName}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-900">What we&apos;re filming</h1>
        <p className="mt-1 text-sm text-neutral-500">
          One video a day. Watch the example, follow the steps.
        </p>
      </header>

      {todayCard ? (
        <Card card={todayCard} today={today} />
      ) : (
        <section className="rounded-3xl p-6 text-sm text-neutral-600" style={GLASS}>
          Nothing scheduled for today
          {upcoming.length > 0 ? ' — the next one is below.' : '. Check back tomorrow.'}
        </section>
      )}

      {upcoming.length > 0 && (
        <>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Coming up
          </h2>
          {visible.map((c) => (
            <Card key={c.id} card={c} today={today} />
          ))}
          {!showAll && upcoming.length > visible.length && (
            <button
              onClick={() => setShowAll(true)}
              className="self-start rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
            >
              Show {upcoming.length - visible.length} more
            </button>
          )}
        </>
      )}

      {cards.length === 0 && (
        <p className="text-sm text-neutral-500">
          No shoots scheduled yet.
        </p>
      )}
    </main>
  )
}
