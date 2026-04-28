import { redirect } from 'next/navigation'
import { resolveAccess } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import Wizard from './Wizard'

export const dynamic = 'force-dynamic'

interface OnboardingPageProps {
  searchParams: { welcome?: string }
}

export default async function OnboardingPage({
  searchParams,
}: OnboardingPageProps) {
  const access = await resolveAccess()
  if (!access) redirect('/')

  const welcome = searchParams.welcome === '1'

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
      welcome={welcome}
      tokenDoctorName={access.doctorName}
      initial={{
        clinicName: clinic.name ?? '',
        doctorName: clinic.doctor_name ?? access.doctorName ?? '',
        services: clinic.services ?? [],
        deepDiveTopics: clinic.deep_dive_topics ?? [],
        contentPillars: clinic.content_pillars ?? [],
        contrarianOpinions: [], // never prefilled — would dup as new insights
      }}
    />
  )
}
