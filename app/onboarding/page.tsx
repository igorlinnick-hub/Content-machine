import { redirect } from 'next/navigation'
import { resolveAccess } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import Wizard from './Wizard'

export const dynamic = 'force-dynamic'

interface OnboardingPageProps {
  searchParams: { welcome?: string; clinicId?: string; groupId?: string; seedFrom?: string }
}

export default async function OnboardingPage({
  searchParams,
}: OnboardingPageProps) {
  const access = await resolveAccess()
  if (!access) redirect('/')

  const welcome = searchParams.welcome === '1'
  const supabase = createServerClient()

  // Admin with ?clinicId → edit that clinic. Admin without → create new (or add doctor).
  if (access.role === 'admin') {
    const editClinicId = searchParams.clinicId
    const groupId = searchParams.groupId
    const seedFrom = searchParams.seedFrom

    // No clinicId and no groupId → fresh brand + first doctor
    if (!editClinicId && !groupId) return <Wizard mode="create" />

    // groupId present → add a new doctor to an existing brand
    if (groupId && !editClinicId) {
      const { data: group } = await supabase
        .from('clinic_groups')
        .select('name, logo_url')
        .eq('id', groupId)
        .single()

      return (
        <Wizard
          mode="create"
          groupId={groupId}
          seedFromClinicId={seedFrom}
          lockedBrandName={group?.name ?? undefined}
        />
      )
    }

    const { data: clinic } = await supabase
      .from('clinics')
      .select('name, full_name, doctor_name, services, content_pillars, deep_dive_topics')
      .eq('id', editClinicId!)
      .single()

    if (!clinic) redirect('/dashboard')

    return (
      <Wizard
        mode="edit"
        clinicId={editClinicId}
        initial={{
          clinicName: clinic.name ?? '',
          fullName: clinic.full_name ?? '',
          doctorName: clinic.doctor_name ?? '',
          services: clinic.services ?? [],
          deepDiveTopics: clinic.deep_dive_topics ?? [],
          contentPillars: clinic.content_pillars ?? [],
          contrarianOpinions: [],
        }}
      />
    )
  }

  // Doctor / editor — load their clinic for prefill, render in edit mode.
  const { data: clinic } = await supabase
    .from('clinics')
    .select('name, full_name, doctor_name, services, content_pillars, deep_dive_topics')
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
        fullName: clinic.full_name ?? '',
        doctorName: clinic.doctor_name ?? access.doctorName ?? '',
        services: clinic.services ?? [],
        deepDiveTopics: clinic.deep_dive_topics ?? [],
        contentPillars: clinic.content_pillars ?? [],
        contrarianOpinions: [],
      }}
    />
  )
}
