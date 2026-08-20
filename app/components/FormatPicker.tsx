'use client'

import { useEffect, useRef, useState } from 'react'
import { FORMAT_CHOICES } from '@/lib/posts/formats'

// The "HOW we say it" control (Igor 2026-08-19). The content plan decides what
// a week talks about; this decides the shape the post takes — educational
// explainer, practical tips, warning signs, myths, and the rest of the catalog.
// One chip that opens the list; used both on plan topics and in the New Post
// panel, so the marketer meets the same control in both places.
export function FormatPicker({
  value,
  onChange,
  color = '#0ea5e9',
  disabled = false,
  align = 'right',
}: {
  value: string | null
  onChange: (format: string | null) => void
  color?: string
  disabled?: boolean
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const current = FORMAT_CHOICES.find((f) => f.name === value) ?? null

  return (
    <div ref={boxRef} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        title={
          current
            ? `Format: ${current.name} — ${current.hint}`
            : 'Format — choose how this post is written'
        }
        className="max-w-[130px] truncate rounded-full border px-2 py-0.5 text-[10px] font-semibold transition hover:opacity-80 disabled:opacity-40"
        style={
          current
            ? { background: `${color}18`, color, borderColor: `${color}35` }
            : {
                background: 'transparent',
                color: '#a3a3a3',
                borderColor: 'rgba(0,0,0,0.10)',
                borderStyle: 'dashed',
              }
        }
      >
        {current ? current.label : 'Format'}
      </button>

      {open && (
        <div
          className={`absolute z-30 mt-1.5 w-[268px] overflow-hidden rounded-xl border border-neutral-200 bg-white/95 shadow-xl backdrop-blur ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <p className="border-b border-neutral-100 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400">
            How this post is written
          </p>
          <div className="max-h-[320px] overflow-y-auto py-1">
            {FORMAT_CHOICES.map((f) => {
              const active = f.name === value
              return (
                <button
                  key={f.name}
                  type="button"
                  onClick={() => {
                    onChange(active ? null : f.name)
                    setOpen(false)
                  }}
                  className="flex w-full flex-col gap-0.5 px-3 py-2 text-left transition hover:bg-neutral-50"
                  style={active ? { background: `${color}0f` } : undefined}
                >
                  <span
                    className="text-[12px] font-semibold"
                    style={{ color: active ? color : '#404040' }}
                  >
                    {active ? '✓ ' : ''}
                    {f.name}
                  </span>
                  <span className="text-[11px] leading-snug text-neutral-500">
                    {f.hint}
                  </span>
                </button>
              )
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              onChange(null)
              setOpen(false)
            }}
            className="w-full border-t border-neutral-100 px-3 py-2 text-left text-[11px] font-semibold text-neutral-400 transition hover:bg-neutral-50 hover:text-neutral-600"
          >
            Auto — let the writer choose
          </button>
        </div>
      )}
    </div>
  )
}
