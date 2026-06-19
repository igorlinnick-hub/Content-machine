'use client'

import { cn } from '@/lib/utils'

interface Props {
  borderWidth?: number
  duration?: number
  shineColor?: string | string[]
  className?: string
}

export function ShineBorder({ borderWidth = 1, duration = 10, shineColor = ['#38bdf8', '#a78bfa', '#2dd4bf'], className }: Props) {
  const colors = Array.isArray(shineColor) ? shineColor.join(',') : shineColor
  return (
    <div
      aria-hidden
      style={{
        '--border-width': `${borderWidth}px`,
        '--duration': `${duration}s`,
        backgroundImage: `radial-gradient(transparent, transparent, ${colors}, transparent, transparent)`,
        backgroundSize: '300% 300%',
        WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
        mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
        WebkitMaskComposite: 'xor',
        maskComposite: 'exclude',
        padding: 'var(--border-width)',
      } as React.CSSProperties}
      className={cn(
        'animate-shine pointer-events-none absolute inset-0 size-full rounded-[inherit] will-change-[background-position]',
        className
      )}
    />
  )
}
