'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export interface TypingAnimationProps {
  text: string
  duration?: number
  delay?: number
  className?: string
  as?: keyof JSX.IntrinsicElements
  startOnView?: boolean
}

export function TypingAnimation({
  text,
  duration = 100,
  delay = 0,
  className,
  as: Component = 'div',
}: TypingAnimationProps) {
  const [displayedText, setDisplayedText] = useState('')
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const startTimer = setTimeout(() => setStarted(true), delay)
    return () => clearTimeout(startTimer)
  }, [delay])

  useEffect(() => {
    if (!started) return
    if (displayedText === text) return
    const timer = setTimeout(() => {
      setDisplayedText(text.slice(0, displayedText.length + 1))
    }, duration)
    return () => clearTimeout(timer)
  }, [started, displayedText, text, duration])

  return (
    <Component
      className={cn(
        'after:ml-px after:inline-block after:h-[1em] after:w-[2px] after:translate-y-[2px] after:animate-blink-cursor after:bg-current after:align-middle',
        className,
      )}
    >
      {displayedText}
    </Component>
  )
}
