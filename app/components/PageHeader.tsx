import Link from 'next/link'
import { Logomark } from './Logomark'

interface Props {
  eyebrow?: string
  eyebrowColor?: string
  title: string
  subtitle?: string | null
  back?: string
  backLabel?: string
  right?: React.ReactNode
}

export function PageHeader({
  eyebrow,
  eyebrowColor = 'text-sky-500',
  title,
  subtitle,
  back,
  backLabel = 'Dashboard',
  right,
}: Props) {
  return (
    <header className="flex flex-col gap-4 border-b border-neutral-200/80 pb-7 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p
            className={`flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] ${eyebrowColor} cm-rise`}
            style={{ animationDelay: '0ms' }}
          >
            <Logomark size={15} />
            {eyebrow}
          </p>
        )}
        <h1
          className="mt-2 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl cm-rise"
          style={{ animationDelay: '70ms' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className="mt-1.5 text-sm leading-relaxed text-neutral-500 cm-rise"
            style={{ animationDelay: '140ms' }}
          >
            {subtitle}
          </p>
        )}
        {back && (
          <Link
            href={back}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-400 transition hover:text-neutral-700 cm-rise"
            style={{ animationDelay: '180ms' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M7.5 9L4.5 6l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {backLabel}
          </Link>
        )}
      </div>
      {right && (
        <div
          className="flex shrink-0 items-center gap-2 cm-rise"
          style={{ animationDelay: '180ms' }}
        >
          {right}
        </div>
      )}
    </header>
  )
}
