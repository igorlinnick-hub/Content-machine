import { redirect } from 'next/navigation'
import { resolveAccess } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import { TeleprompterView } from './components/TeleprompterView'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Teleprompter — Content Machine' }

interface PageProps {
  searchParams: { clinicId?: string }
}

export default async function TeleprompterPage({ searchParams }: PageProps) {
  const access = await resolveAccess()
  if (!access) redirect('/')

  const clinicId =
    access.role === 'admin'
      ? searchParams.clinicId ?? ''
      : access.clinicId

  if (!clinicId) redirect('/dashboard')

  const supabase = createServerClient()

  const [{ data: clinic }, { data: scripts }] = await Promise.all([
    supabase
      .from('clinics')
      .select('name, full_name')
      .eq('id', clinicId)
      .single(),
    supabase
      .from('scripts')
      .select('id, topic, full_script')
      .eq('clinic_id', clinicId)
      .not('full_script', 'is', null)
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  if (!clinic) redirect('/dashboard')

  return (
    <main className="min-h-screen cm-page-bg">
      <TeleprompterView
        clinicId={clinicId}
        clinicName={clinic.full_name ?? clinic.name}
        recentScripts={(scripts ?? []).map((s) => ({
          id: s.id,
          title: s.topic ?? 'Untitled',
          body: s.full_script ?? '',
        }))}
      />
    </main>
  )
}
