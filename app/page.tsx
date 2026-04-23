import Link from 'next/link'
import { redirect } from 'next/navigation'
import { loadClinicList } from '@/lib/supabase/context'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const clinics = await loadClinicList().catch(() => [])
  if (clinics.length > 0) redirect(`/dashboard?clinicId=${clinics[0].id}`)

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-500">
          Content Machine
        </p>
        <h1 className="text-4xl font-semibold leading-tight text-neutral-900 sm:text-5xl">
          AI content ops for regenerative-medicine clinics.
        </h1>
        <p className="text-base text-neutral-600">
          Five-minute setup. Daily notes. Three script variants per round.
          The writer learns every time you pick one.
        </p>
        <Link href="/onboarding" className="cm-btn cm-btn-primary text-base sm:px-7 sm:py-3">
          Start clinic setup →
        </Link>
      </div>
    </main>
  )
}
