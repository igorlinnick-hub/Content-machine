/* eslint-disable @next/next/no-img-element */
'use client'

import { useState } from 'react'
import { Sparkle, SparkleSpinner } from '@/app/components/ui/icons'

export type SlideKind = 'cover' | 'body' | 'cta'

export interface UISlide {
  kind: SlideKind
  text: string
  chip?: string | null
  subtext?: string | null
}

// Result of a per-slide regenerate. The parent owns the fetch (it holds
// slideSetId + drafts); the editor only drives the little UI around it.
export interface RegenResult {
  ok: boolean
  warning?: string | null
  error?: string
}

interface Props {
  slideSetId: string
  index: number
  slide: UISlide
  preview: string | null
  onSlideChange: (next: UISlide) => void
  // Regenerate THIS slide's text via the writer. Empty instruction =
  // a fresh rewrite with the same meaning; a note steers the rewrite
  // ("shorter", "add the stat", "warmer"). Returns ok/warning/error so
  // the editor can surface exactly what happened — never silent.
  onRegenerate?: (instruction: string) => Promise<RegenResult>
  // Opens the PhotoPicker modal in the parent. Only fired for body/cta
  // slides — the classic cover layout doesn't render a photo. Parent
  // owns the modal lifecycle (knows the drive folder + current
  // override map).
  onChangePhoto?: () => void
}

export function SlideEditor({ index, slide, preview, onSlideChange, onRegenerate }: Props) {
  const kindLabel =
    slide.kind === 'cover' ? 'Cover' : slide.kind === 'cta' ? 'CTA' : 'Body'

  // Regenerate UI state — local to this slide card.
  const [busy, setBusy] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function regen(note: string) {
    if (!onRegenerate || busy) return
    setBusy(true)
    setWarning(null)
    setError(null)
    const res = await onRegenerate(note)
    setBusy(false)
    if (!res.ok) {
      setError(res.error ?? 'Regenerate failed')
      return
    }
    setWarning(res.warning ?? null)
  }

  return (
    <li className="cm-card overflow-hidden p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Slide {index + 1} · {kindLabel}
        </span>

        {/* Regenerate toolbar — the button lives above every slide.
            While rewriting: just the sparkle animation, nothing else. */}
        {onRegenerate && (
          busy ? (
            <SparkleSpinner size={15} className="text-sky-500" />
          ) : (
            <button
              type="button"
              onClick={() => regen('')}
              className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700 transition hover:border-sky-300 hover:bg-sky-100"
              title="Rewrite this slide's text with a fresh take"
            >
              <Sparkle size={12} twin /> Regenerate
            </button>
          )
        )}
      </div>

      {/* Regenerate feedback — warning (rewrite happened but agent
          overrode the note) or a hard error. Never silent. */}
      {warning && (
        <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800">
          {warning}
        </div>
      )}
      {error && (
        <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px]">
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              {slide.kind === 'cover'
                ? 'Eyebrow / chip'
                : slide.kind === 'cta'
                ? 'Headline'
                : 'Chip'}
            </span>
            <input
              type="text"
              value={slide.chip ?? ''}
              onChange={(e) =>
                onSlideChange({ ...slide, chip: e.target.value || null })
              }
              className="cm-input text-sm"
            />
          </label>
          {(slide.kind === 'cover' || slide.kind === 'cta' || slide.subtext !== null) && (
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                {slide.kind === 'cover' ? 'Subhead' : 'Subtext'}
              </span>
              <input
                type="text"
                value={slide.subtext ?? ''}
                onChange={(e) =>
                  onSlideChange({ ...slide, subtext: e.target.value || null })
                }
                className="cm-input text-sm"
              />
            </label>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              {slide.kind === 'cover'
                ? 'Headline'
                : slide.kind === 'cta'
                ? 'Action line'
                : 'Body'}
            </span>
            <textarea
              value={slide.text}
              onChange={(e) => onSlideChange({ ...slide, text: e.target.value })}
              rows={slide.kind === 'body' ? 3 : 2}
              className="cm-input resize-none text-sm"
            />
          </label>
        </div>
        {preview && (
          <figure className="overflow-hidden rounded-md border border-neutral-200 bg-white">
            <img
              src={preview}
              alt={`Slide ${index + 1}`}
              className="w-full object-cover"
              style={{ aspectRatio: '4/5' }}
            />
          </figure>
        )}
      </div>
    </li>
  )
}
