'use client'

interface SlidePreviewProps {
  slides: string[]
  previews: string[]
}

export function SlidePreview({ slides, previews }: SlidePreviewProps) {
  if (slides.length === 0) return null

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {slides.map((text, i) => (
        <figure
          key={i}
          className="flex flex-col gap-2 rounded border border-neutral-200 bg-white p-3"
        >
          {previews[i] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previews[i]}
              alt={`Slide ${i + 1}`}
              className="w-full rounded border border-neutral-100"
            />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center rounded border border-neutral-100 bg-neutral-50 text-xs text-neutral-400">
              no preview
            </div>
          )}
          <figcaption className="text-xs text-neutral-600">
            <span className="font-medium">Slide {i + 1}.</span> {text}
          </figcaption>
        </figure>
      ))}
    </div>
  )
}
