// Custom sparkle — the platform's one bespoke glyph.
//
// Used in place of the 🎨 / ✨ / ⭐ emoji on creative / AI actions
// (Compose in Canva, Generate, Regenerate, Add to Shot List, Image Lab,
// Generate plan). Every other emoji in the UI stays as-is. The spinning
// variant (<SparkleSpinner/>) is the generation/loading indicator.
//
// Inherits `currentColor`, so callers set hue via text-* classes.
// Default size 16 aligns with the 14px button label baseline.

interface IconProps {
  size?: number
  className?: string
}

// Solid four-point star with deep concave waists — reads as a jewel
// facet, not a cartoon star. `twin` adds a small companion star for
// hero actions (the "constellation" variant).
export function Sparkle({ size = 16, className, twin = false }: IconProps & { twin?: boolean }) {
  if (twin) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path
          d="M10.6 4 Q12 11 18.8 12.3 Q12 13.6 10.6 20.6 Q9.2 13.6 2.4 12.3 Q9.2 11 10.6 4 Z"
          fill="currentColor"
        />
        <path
          d="M18.4 2.4 Q18.9 5 21.6 5.5 Q18.9 6 18.4 8.6 Q17.9 6 15.2 5.5 Q17.9 5 18.4 2.4 Z"
          fill="currentColor"
          opacity="0.65"
        />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 2 Q13.6 10.4 22 12 Q13.6 13.6 12 22 Q10.4 13.6 2 12 Q10.4 10.4 12 2 Z"
        fill="currentColor"
      />
    </svg>
  )
}

// Spinning sparkle — the generation/loading indicator. The same star
// mark rotates (with a soft scale breath) while something is being
// generated. Drop it into any "…generating" / "Queuing…" branch.
export function SparkleSpinner({ size = 16, className = '' }: IconProps) {
  return <Sparkle size={size} className={`cm-sparkle-spin ${className}`.trim()} />
}
