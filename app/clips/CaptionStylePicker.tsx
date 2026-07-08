'use client'

import { useState } from 'react'
import { CAPTION_STYLES } from '@/lib/clips/captionStyles'

// Caption template picker (HANDOFF §22.2 п.10). The chosen preset is
// the clinic default: the pipeline burns it into every new clip —
// both cron-picked Inbox uploads and teleprompter Auto-edit. Previews
// are CSS approximations of the libass force_style rendering.

const PREVIEW_TEXT = 'Your captions look like this'

function CaptionPreview({ styleKey }: { styleKey: string }) {
  const base = 'px-2 py-0.5 leading-snug text-center'
  switch (styleKey) {
    case 'clean':
      return (
        <span
          className={`${base} text-[11px] font-bold text-white`}
          style={{ textShadow: '0 0 2px #000, 1px 1px 2px #000, -1px -1px 2px #000' }}
        >
          {PREVIEW_TEXT}
        </span>
      )
    case 'bold':
      return (
        <span
          className={`${base} text-[13px] font-extrabold text-white`}
          style={{ textShadow: '0 0 3px #000, 2px 2px 3px #000, -2px -2px 3px #000' }}
        >
          {PREVIEW_TEXT}
        </span>
      )
    case 'pop':
      return (
        <span
          className={`${base} text-[12px] font-extrabold text-yellow-300`}
          style={{ textShadow: '0 0 3px #000, 2px 2px 3px #000, -2px -2px 3px #000' }}
        >
          {PREVIEW_TEXT}
        </span>
      )
    default:
      // classic — white on a semi-opaque box
      return (
        <span className={`${base} rounded bg-black/60 text-[11px] font-semibold text-white`}>
          {PREVIEW_TEXT}
        </span>
      )
  }
}

export default function CaptionStylePicker({
  clinicId,
  initial,
}: {
  clinicId: string
  initial: string
}) {
  const [selected, setSelected] = useState(initial)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function pick(key: string) {
    if (key === selected || saving) return
    const prev = selected
    setSelected(key)
    setSaving(key)
    setError(null)
    try {
      const res = await fetch(`/api/clips/style?clinicId=${clinicId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ captionStyle: key }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `save failed (${res.status})`)
      }
    } catch (e) {
      setSelected(prev)
      setError(e instanceof Error ? e.message : 'save failed')
    } finally {
      setSaving(null)
    }
  }

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-neutral-900">Caption style</h2>
        <p className="text-xs text-neutral-400">
          Applied to every new clip for this clinic
        </p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {CAPTION_STYLES.map((style) => {
          const active = style.key === selected
          return (
            <button
              key={style.key}
              type="button"
              onClick={() => pick(style.key)}
              disabled={saving !== null}
              className={`group rounded-2xl border p-2 text-left transition ${
                active
                  ? 'border-violet-500 ring-2 ring-violet-200'
                  : 'border-neutral-200 hover:border-neutral-300'
              } ${saving && !active ? 'opacity-60' : ''} bg-white`}
            >
              <div className="flex aspect-[4/3] items-end justify-center overflow-hidden rounded-xl bg-gradient-to-b from-neutral-700 to-neutral-900 pb-3">
                <CaptionPreview styleKey={style.key} />
              </div>
              <div className="mt-2 flex items-center gap-1.5 px-1">
                <span className="text-xs font-semibold text-neutral-800">
                  {style.label}
                </span>
                {active && (
                  <span className="text-[10px] font-medium text-violet-600">
                    {saving === style.key ? 'Saving…' : '✓ Active'}
                  </span>
                )}
              </div>
              <p className="px-1 pb-1 text-[11px] leading-tight text-neutral-400">
                {style.description}
              </p>
            </button>
          )
        })}
      </div>
      {error && <p className="mt-2 text-xs text-rose-500">Failed to save: {error}</p>}
    </section>
  )
}
