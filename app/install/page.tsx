import { redirect } from 'next/navigation'
import { resolveAccess } from '@/lib/auth/session'
import { StandaloneRedirect } from './StandaloneRedirect'
import { InstallScreen } from './InstallScreen'

export const dynamic = 'force-dynamic'

export default async function InstallPage() {
  const access = await resolveAccess()
  if (!access) redirect('/')
  if (access.role === 'admin') redirect('/clinics')

  return (
    <main className="min-h-screen bg-white">
      <StandaloneRedirect />
      <InstallScreen clinicId={access.clinicId} />
    </main>
  )
}
