'use client'

import { AD_FORMAT_CHOICES } from '@/lib/scripts/ad-formats'

// The AD shape control (Igor 2026-08-20). Separate from FormatPicker on
// purpose: post formats answer "how do we say this week's topic", ad formats
// answer "how does a 30-second paid spot hold a stranger". Picking one here
// switches the whole generation — ad beats, the 'ad' length target (~90-140
// words instead of 200-220), and the ad rubric in the Critic.
//
// Rendered as a flat row rather than FormatPicker's dropdown: there are only
// four, and which one you pick is the decision being made on this screen.
export function AdFormatPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string | null
  onChange: (format: string | null) => void
  disabled?: boolean
}) {
  const color = '#7c3aed'
  const current = AD_FORMAT_CHOICES.find((f) => f.name === value) ?? null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400">
          Ad spot
        </span>
        {AD_FORMAT_CHOICES.map((f) => {
          const active = f.name === value
          return (
            <button
              key={f.name}
              type="button"
              disabled={disabled}
              title={`${f.name} — ${f.hint}`}
              onClick={() => onChange(active ? null : f.name)}
              className="rounded-full border px-2.5 py-1 text-[11px] font-semibold transition hover:opacity-80 disabled:opacity-40"
              style={
                active
                  ? { background: `${color}18`, color, borderColor: `${color}45` }
                  : {
                      background: 'transparent',
                      color: '#a3a3a3',
                      borderColor: 'rgba(0,0,0,0.10)',
                      borderStyle: 'dashed',
                    }
              }
            >
              {f.label}
            </button>
          )
        })}
      </div>
      {current && (
        <p className="text-[11px] leading-snug text-neutral-500">
          {current.hint}{' '}
          <span className="text-neutral-400">
            25-45s, no call-to-action in the doctor&apos;s voice.
          </span>
        </p>
      )}
    </div>
  )
}
