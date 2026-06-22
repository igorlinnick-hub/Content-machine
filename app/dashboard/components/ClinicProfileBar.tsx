import Link from 'next/link'

interface Props {
  clinicId: string
  clinicName: string
  doctorName: string | null
  services: string[]
}

export function ClinicProfileBar({ clinicId, clinicName, doctorName, services }: Props) {
  return (
    <div
      className="flex items-center justify-between gap-4 rounded-2xl px-5 py-3.5"
      style={{
        background: 'rgba(255,255,255,0.55)',
        backdropFilter: 'blur(20px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
        border: '1px solid rgba(255,255,255,0.72)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
      }}
    >
      {/* Back to all clinics */}
      <Link
        href="/dashboard"
        className="flex items-center gap-1.5 text-[12px] font-medium text-neutral-400 transition hover:text-neutral-600"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        All clinics
      </Link>

      {/* Clinic identity */}
      <div className="flex min-w-0 flex-1 items-center gap-3 px-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-neutral-800">{clinicName}</p>
          {doctorName && (
            <p className="truncate text-[11px] text-neutral-400">Dr. {doctorName}</p>
          )}
        </div>
        {services.slice(0, 2).map((s) => (
          <span
            key={s}
            className="hidden shrink-0 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-sky-600 sm:inline-block"
          >
            {s}
          </span>
        ))}
      </div>

      {/* Edit clinic settings */}
      <Link
        href={`/onboarding?clinicId=${clinicId}`}
        className="flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-neutral-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
        </svg>
        Edit profile
      </Link>
    </div>
  )
}
