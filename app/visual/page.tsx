import Link from 'next/link'
import { redirect } from 'next/navigation'
import { loadClinicList } from '@/lib/supabase/context'
import { loadPosts } from '@/lib/visual/store'
import { resolveAccess } from '@/lib/auth/session'
import { getCurrentPlanWeek } from '@/lib/content-plan'
import { PostsWorkspace } from './components/PostsWorkspace'
import { RoleBadge } from '@/app/components/RoleBadge'
import { PageHeader } from '@/app/components/PageHeader'

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

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-5 py-8 cm-page-bg sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Visual Posts"
        title={clinic.name}
        back={`/dashboard?clinicId=${clinic.id}`}
        right={
          <>
            <Link href="/compliance" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100">
              Compliance
            </Link>
            <RoleBadge role="admin" />
          </>
        }
      />

      <PostsWorkspace clinicId={clinic.id} posts={posts} currentWeek={currentPlanWeek} />
    </main>
  )
}
