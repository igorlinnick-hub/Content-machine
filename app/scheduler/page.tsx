import { redirect } from 'next/navigation'
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

  const clinicId =
    access.role === 'admin' ? searchParams.clinicId ?? '' : access.clinicId

  return <SchedulerView clinicId={clinicId} />
}
