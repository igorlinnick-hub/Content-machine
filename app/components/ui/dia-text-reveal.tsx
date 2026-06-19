'use client'

import { useEffect, useRef, useState } from 'react'
import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { cn } from '@/lib/utils'

const DEFAULT_COLORS = ['#38bdf8', '#a78bfa', '#2dd4bf', '#fbbf24']
const BAND_HALF = 17
const SWEEP_START = -BAND_HALF
const SWEEP_END = 100 + BAND_HALF

const sweepEase = (t: number) =>
  t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2

function buildGradient(pos: number, colors: string[], textColor: string) {
  const bandStart = pos - BAND_HALF
  const bandEnd = pos + BAND_HALF
  if (bandStart >= 100) return `linear-gradient(90deg, ${textColor}, ${textColor})`
  const n = colors.length
  const parts: string[] = []
  if (bandStart > 0) parts.push(`${textColor} 0%`, `${textColor} ${bandStart.toFixed(2)}%`)
  colors.forEach((c, i) => {
    const pct = n === 1 ? pos : bandStart + (i / (n - 1)) * BAND_HALF * 2
    parts.push(`${c} ${pct.toFixed(2)}%`)
  })
  if (bandEnd < 100) parts.push(`transparent ${bandEnd.toFixed(2)}%`, `transparent 100%`)
  return `linear-gradient(90deg, ${parts.join(', ')})`
}

export interface DiaTextRevealProps {
  text: string | string[]
  colors?: string[]
  textColor?: string
  duration?: number
  delay?: number
  className?: string
}

export function DiaTextReveal({
  text,
  colors = DEFAULT_COLORS,
  textColor = 'currentColor',
  duration = 1.5,
  delay = 0,
  className,
}: DiaTextRevealProps) {
  const texts = Array.isArray(text) ? text : [text]
  const prefersReducedMotion = useReducedMotion()
  const spanRef = useRef<HTMLSpanElement>(null)
  const sweepPos = useMotionValue(SWEEP_START)
  const backgroundImage = useTransform(sweepPos, (pos) =>
    buildGradient(pos, colors, textColor)
  )
  const isInView = useInView(spanRef, { once: true, amount: 0.1 })
  const [played, setPlayed] = useState(false)

  useEffect(() => {
    if (prefersReducedMotion) { sweepPos.set(SWEEP_END); return }
    if (!isInView || played) return
    setPlayed(true)
    animate(sweepPos, SWEEP_END, { duration, delay, ease: sweepEase })
  }, [isInView, prefersReducedMotion, played, sweepPos, duration, delay])

  return (
    <motion.span
      ref={spanRef}
      className={cn('align-bottom leading-[100%] text-inherit', className)}
      style={{
        color: 'transparent',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        backgroundSize: '100% 100%',
        backgroundImage,
      }}
    >
      {texts[0]}
    </motion.span>
  )
}
