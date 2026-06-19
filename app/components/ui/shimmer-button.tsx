import { type ComponentPropsWithoutRef, type CSSProperties, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface Props extends ComponentPropsWithoutRef<'button'> {
  shimmerColor?: string
  background?: string
  borderRadius?: string
}

export const ShimmerButton = forwardRef<HTMLButtonElement, Props>(
  (
    {
      shimmerColor = 'rgba(255,255,255,0.5)',
      background = 'linear-gradient(135deg, #0ea5e9, #0284c7)',
      borderRadius = '12px',
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        style={
          {
            '--shimmer-color': shimmerColor,
            '--speed': '2.5s',
            '--bg': background,
            '--radius': borderRadius,
            background: 'var(--bg)',
            borderRadius: 'var(--radius)',
          } as CSSProperties
        }
        className={cn(
          'group relative z-0 flex cursor-pointer items-center justify-center overflow-hidden border border-white/10 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 active:scale-[0.98] @container',
          className
        )}
        {...props}
      >
        {/* shimmer spark layer */}
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden blur-[2px]">
          <div className="animate-shimmer-slide absolute inset-0 aspect-square h-[100cqh]">
            <div
              className="animate-spin-around absolute -inset-full"
              style={{
                background: `conic-gradient(from 270deg, transparent 0%, var(--shimmer-color) 20%, transparent 40%)`,
              }}
            />
          </div>
        </div>

        {children}

        {/* inner backdrop */}
        <div
          className="absolute inset-[1px] -z-10 rounded-[calc(var(--radius)-1px)]"
          style={{ background: 'var(--bg)' }}
        />
      </button>
    )
  }
)
ShimmerButton.displayName = 'ShimmerButton'
