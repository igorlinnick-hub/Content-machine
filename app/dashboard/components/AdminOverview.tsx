import Link from 'next/link'

interface ClinicSummary {
  id: string
  name: string
  doctor_name: string | null
  services: string[]
}

const GLASS_CARD = {
  background: 'rgba(255,255,255,0.60)',
  backdropFilter: 'blur(24px) saturate(1.8)',
  WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
  border: '1px solid rgba(255,255,255,0.75)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 1px 0 rgba(255,255,255,0.95) inset',
} as const

const ACCENT_COLORS = [
  { tag: '#38bdf8', bg: 'linear-gradient(135deg,#0ea5e9,#0284c7)' },
  { tag: '#a78bfa', bg: 'linear-gradient(135deg,#8b5cf6,#7c3aed)' },
  { tag: '#2dd4bf', bg: 'linear-gradient(135deg,#14b8a6,#0d9488)' },
  { tag: '#fb7185', bg: 'linear-gradient(135deg,#f43f5e,#e11d48)' },
]

function InitialAvatar({ name, bg }: { name: string; bg: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
  return (
    <div
      className="flex h-12 w-12 items-center justify-center rounded-2xl text-base font-bold text-white shadow-md"
      style={{ background: bg }}
    >
      {initials}
    </div>
  )
}

function ClinicCard({
  clinic,
  accent,
}: {
  clinic: ClinicSummary
  accent: (typeof ACCENT_COLORS)[number]
}) {
  const topService = clinic.services[0] ?? null

  return (
    <Link
      href={`/dashboard?clinicId=${clinic.id}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-0.5"
      style={GLASS_CARD}
    >
      {/* Hover tint */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `radial-gradient(ellipse at 20% 0%, ${accent.tag}12 0%, transparent 65%)` }}
      />

      <div className="relative flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between">
          <InitialAvatar name={clinic.doctor_name ?? clinic.name} bg={accent.bg} />
          {topService && (
            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]"
              style={{ background: `${accent.tag}18`, color: accent.tag, border: `1px solid ${accent.tag}30` }}
            >
              {topService}
            </span>
          )}
        </div>

        <div>
          <h3 className="text-[15px] font-semibold tracking-tight text-neutral-900">
            {clinic.name}
          </h3>
          {clinic.doctor_name && (
            <p className="mt-0.5 text-[13px] text-neutral-500">
              Dr. {clinic.doctor_name}
            </p>
          )}
        </div>
      </div>

      {/* Arrow */}
      <div className="absolute bottom-5 right-5 translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-900 text-white shadow-sm">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </div>
      </div>
    </Link>
  )
}

function AddDoctorCard() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-neutral-200 p-5 text-center transition-colors hover:border-sky-300 hover:bg-sky-50/40 cursor-pointer"
      style={{ minHeight: 160 }}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </div>
      <div>
        <p className="text-[13px] font-semibold text-neutral-500">Add new doctor</p>
        <p className="mt-0.5 text-[11px] text-neutral-400">Amber · Botox</p>
      </div>
    </div>
  )
}

export function AdminOverview({ clinics }: { clinics: ClinicSummary[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
          Active clinics
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {clinics.map((c, i) => (
          <ClinicCard
            key={c.id}
            clinic={c}
            accent={ACCENT_COLORS[i % ACCENT_COLORS.length]}
          />
        ))}
        <AddDoctorCard />
      </div>
    </div>
  )
}
