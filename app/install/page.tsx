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
    <main
      className="flex min-h-screen items-center justify-center p-4 sm:p-8"
      style={{
        background:
          'radial-gradient(120% 90% at 8% 4%, rgba(58,174,160,0.13) 0%, rgba(58,174,160,0) 46%), radial-gradient(110% 85% at 96% 92%, rgba(245,237,224,0.85) 0%, rgba(245,237,224,0) 52%), linear-gradient(168deg, #fdfcfa 0%, #f3f7f8 100%)',
      }}
    >
      <StandaloneRedirect />
      <InstallScreen clinicId={access.clinicId} />
    </main>
  )
}
