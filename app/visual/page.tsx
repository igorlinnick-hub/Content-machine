import { redirect } from 'next/navigation'
import { loadClinicList } from '@/lib/supabase/context'
import { loadPosts } from '@/lib/visual/store'
import { resolveAccess } from '@/lib/auth/session'
import { getCurrentPlanWeek } from '@/lib/content-plan'
import { createServerClient } from '@/lib/supabase/server'
import { PostsWorkspace } from './components/PostsWorkspace'
import { TemplatesButton } from './components/TemplatesButton'
import { RoleBadge } from '@/app/components/RoleBadge'
import { PageHeader } from '@/app/components/PageHeader'
import type { ScriptFormatTemplate, ScriptLengthTarget } from '@/types'

// Videos tab removed from /visual — marketer's workflow is post
// carousels only. The video pipeline (Seedance via Replicate) still
// exists at lib/videos and /api/videos/generate, just isn't surfaced
// here. If a future use case wants videos back, re-add the tab + the
// VideosWorkspace import.

export const dynamic = 'force-dynamic'

interface VisualPageProps {
  searchParams: { clinicId?: string }
}

export default async function VisualPage({ searchParams }: VisualPageProps) {
  const access = await resolveAccess()
  if (!access) redirect('/')
  if (access.role !== 'admin') redirect('/dashboard')

  const clinics = await loadClinicList()
  if (clinics.length === 0) redirect('/onboarding')

  const clinicId = searchParams.clinicId ?? clinics[0].id
  const clinic = clinics.find((c) => c.id === clinicId) ?? clinics[0]

  const posts = await loadPosts(clinic.id, 50)
  const currentPlanWeek = getCurrentPlanWeek()

  const supabase = createServerClient()
  const { data: rawTemplates } = await supabase
    .from('script_templates')
    .select('id, name, description, scaffold, length_bias')
    .eq('clinic_id', clinic.id)
    .eq('active', true)
    .order('position', { ascending: true })
    .order('created_at', { ascending: false })

  const templates: ScriptFormatTemplate[] = (rawTemplates ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    scaffold: r.scaffold,
    length_bias: r.length_bias as ScriptLengthTarget | null,
  }))

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-5 py-8 cm-page-bg sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Visual Posts"
        title={clinic.name}
        back={`/dashboard?clinicId=${clinic.id}`}
        right={
          <>
            <TemplatesButton templates={templates} />
            <RoleBadge role="admin" />
          </>
        }
      />

      <PostsWorkspace clinicId={clinic.id} posts={posts} currentWeek={currentPlanWeek} />
    </main>
  )
}
