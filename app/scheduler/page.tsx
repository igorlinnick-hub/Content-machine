import { redirect } from 'next/navigation'
import { loadClinicList } from '@/lib/supabase/context'
import { resolveAccess } from '@/lib/auth/session'
import { SchedulerView } from './components/SchedulerView'

export const dynamic = 'force-dynamic'

export default async function SchedulerPage({
  searchParams,
}: {
  searchParams: { clinicId?: string }
}) {
  const access = await resolveAccess()
  if (!access) redirect('/')

  // Admin without ?clinicId falls back to the first clinic — same rule as
  // /visual and /dashboard. Without it the calendar rendered the static plan
  // but never loaded a single real scheduled post.
  let clinicId: string
  if (access.role === 'admin') {
    const clinics = await loadClinicList()
    if (clinics.length === 0) redirect('/onboarding')
    clinicId = clinics.find((c) => c.id === searchParams.clinicId)?.id ?? clinics[0].id
  } else {
    clinicId = access.clinicId
  }

  return <SchedulerView clinicId={clinicId} />
}
