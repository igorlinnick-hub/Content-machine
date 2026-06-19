'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  number?: number
  className?: string
  color?: string
}

export function Meteors({ number = 12, className, color = '#38bdf8' }: Props) {
  const [styles, setStyles] = useState<React.CSSProperties[]>([])

  useEffect(() => {
    setStyles(
      Array.from({ length: number }, () => ({
        '--angle': '-45deg',
        top: '-5%',
        left: `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 3}s`,
        animationDuration: `${2 + Math.random() * 4}s`,
      } as React.CSSProperties)
    ))
  }, [number])

  return (
    <>
      {styles.map((style, i) => (
        <span
          key={i}
          style={style}
          className={cn(
            'animate-meteor pointer-events-none absolute h-px w-16 rotate-[-45deg] rounded-full opacity-70',
            className
          )}
          aria-hidden
        >
          <div
            className="pointer-events-none absolute top-1/2 h-px w-16 -translate-y-1/2"
            style={{ background: `linear-gradient(to right, ${color}, transparent)` }}
          />
        </span>
      ))}
    </>
  )
}
