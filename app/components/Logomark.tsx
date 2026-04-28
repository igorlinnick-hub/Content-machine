interface LogomarkProps {
  size?: number
  className?: string
}

// Two intersecting waves with a center node — reads as pulse / cell /
// regeneration. Pure SVG, no external assets, scales cleanly. Color is
// taken from `currentColor` so callers control the hue with text-* classes.
export function Logomark({ size = 28, className }: LogomarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M3 20 Q9 8 16 20 T29 20"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d="M3 13 Q9 25 16 13 T29 13"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="16" cy="16" r="2.6" fill="currentColor" />
    </svg>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      <Logomark size={22} className="align-[-4px] text-sky-500 inline-block mr-2" />
      <span className="font-semibold tracking-tight">Content Machine</span>
    </span>
  )
}
