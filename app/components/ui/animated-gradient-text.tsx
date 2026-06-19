import { type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

interface Props extends ComponentPropsWithoutRef<'span'> {
  speed?: number
  colorFrom?: string
  colorVia?: string
  colorTo?: string
}

export function AnimatedGradientText({
  children,
  className,
  speed = 1,
  colorFrom = '#38bdf8',
  colorVia = '#a78bfa',
  colorTo = '#2dd4bf',
  ...props
}: Props) {
  return (
    <span
      style={{
        backgroundSize: `${speed * 300}% 100%`,
        backgroundImage: `linear-gradient(to right, ${colorFrom}, ${colorVia}, ${colorTo}, ${colorFrom})`,
      }}
      className={cn('animate-gradient bg-clip-text text-transparent', className)}
      {...props}
    >
      {children}
    </span>
  )
}
