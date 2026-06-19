'use client'

import { useEffect, useRef } from 'react'
import { useInView, useMotionValue, useSpring } from 'motion/react'
import { cn } from '@/lib/utils'

export interface NumberTickerProps {
  value: number
  direction?: 'up' | 'down'
  delay?: number
  decimalPlaces?: number
  className?: string
}

export function NumberTicker({
  value,
  direction = 'up',
  delay = 0,
  decimalPlaces = 0,
  className,
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const motionValue = useMotionValue(direction === 'down' ? value : 0)
  const springValue = useSpring(motionValue, { damping: 60, stiffness: 100 })
  const isInView = useInView(ref, { once: true, margin: '0px' })

  useEffect(() => {
    if (!isInView) return
    const timer = setTimeout(() => {
      motionValue.set(direction === 'down' ? 0 : value)
    }, delay * 1000)
    return () => clearTimeout(timer)
  }, [isInView, delay, motionValue, direction, value])

  useEffect(
    () =>
      springValue.on('change', (latest) => {
        if (ref.current) {
          ref.current.textContent = Intl.NumberFormat('en-US', {
            minimumFractionDigits: decimalPlaces,
            maximumFractionDigits: decimalPlaces,
          }).format(Number(latest.toFixed(decimalPlaces)))
        }
      }),
    [springValue, decimalPlaces],
  )

  return (
    <span
      ref={ref}
      className={cn('inline-block tabular-nums tracking-tight', className)}
    >
      {direction === 'down' ? value : 0}
    </span>
  )
}
