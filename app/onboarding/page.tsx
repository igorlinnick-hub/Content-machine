import { redirect } from 'next/navigation'
import { resolveAccess } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import Wizard from './Wizard'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const access = await resolveAccess()
  if (!access) redirect('/')

  if (access.role === 'admin') {
    return <Wizard mode="create" />
  }

  // Doctor / editor — load their clinic for prefill, render in edit mode.
  const supabase = createServerClient()
  const { data: clinic } = await supabase
    .from('clinics')
    .select('name, doctor_name, services, content_pillars, deep_dive_topics')
    .eq('id', access.clinicId)
    .single()

  if (!clinic) redirect('/')

  return (
    <Wizard
      mode="edit"
      initial={{
        clinicName: clinic.name ?? '',
        doctorName: clinic.doctor_name ?? '',
        services: clinic.services ?? [],
        deepDiveTopics: clinic.deep_dive_topics ?? [],
        contentPillars: clinic.content_pillars ?? [],
        contrarianOpinions: [], // never prefilled — would dup as new insights
      }}
    />
  )
}
