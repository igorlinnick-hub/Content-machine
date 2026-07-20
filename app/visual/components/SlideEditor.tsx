/* eslint-disable @next/next/no-img-element */
'use client'

export type SlideKind = 'cover' | 'body' | 'cta'

export interface UISlide {
  kind: SlideKind
  text: string
  chip?: string | null
  subtext?: string | null
}

interface Props {
  slideSetId: string
  index: number
  slide: UISlide
  preview: string | null
  onSlideChange: (next: UISlide) => void
  // Opens the PhotoPicker modal in the parent. Only fired for body/cta
  // slides — the classic cover layout doesn't render a photo. Parent
  // owns the modal lifecycle (knows the drive folder + current
  // override map).
  onChangePhoto?: () => void
}

export function SlideEditor({ index, slide, preview, onSlideChange }: Props) {
  const kindLabel =
    slide.kind === 'cover' ? 'Cover' : slide.kind === 'cta' ? 'CTA' : 'Body'

  return (
    <li className="cm-card overflow-hidden p-3">
      <div className="mb-2 text-xs text-neutral-500">
        <span className="font-semibold uppercase tracking-wider">
          Slide {index + 1} · {kindLabel}
        </span>
      </div>
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
