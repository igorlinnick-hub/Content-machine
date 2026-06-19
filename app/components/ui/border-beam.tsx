'use client'

import { cn } from '@/lib/utils'

interface Props {
  colorFrom?: string
  colorTo?: string
  duration?: number
  size?: number
  bg?: string
  className?: string
}

// Pure-CSS border beam — no framer-motion needed.
// Works by rotating a conic-gradient under a mask that reveals only the border.
export function BorderBeam({
  colorFrom = '#38bdf8',
  colorTo = '#a78bfa',
  duration = 4,
  size = 120,
  bg,
  className,
}: Props) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 rounded-[inherit] overflow-hidden', className)}
    >
      {/* spinning conic layer */}
      <div
        className="absolute inset-[-50%]"
        style={{
          background: `conic-gradient(from 0deg, transparent 0%, ${colorFrom} 8%, ${colorTo} 16%, transparent 20%)`,
          animation: `spin ${duration}s linear infinite`,
          width: '200%',
          height: '200%',
        }}
      />
      {/* inner mask — hides centre, reveals only ~1px border */}
      <div className="absolute inset-[1px] rounded-[inherit]" style={{ background: bg ?? 'var(--hero-bg, #07111e)' }} />
    </div>
  )
}
