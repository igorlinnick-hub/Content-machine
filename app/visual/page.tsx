import Link from 'next/link'
import { redirect } from 'next/navigation'
import { loadClinicList } from '@/lib/supabase/context'
import { loadPosts } from '@/lib/visual/store'
import { resolveAccess } from '@/lib/auth/session'
import { PostsWorkspace } from './components/PostsWorkspace'
import { RoleBadge } from '@/app/components/RoleBadge'

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

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-5 py-6 sm:px-6 sm:py-8">
      <header className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-sky-500">
            Workspace
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-neutral-900">
            {clinic.name}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/compliance" className="cm-btn cm-btn-ghost text-sm">
            ⚖️ Compliance
          </Link>
          <Link
            href={`/dashboard?clinicId=${clinic.id}`}
            className="cm-btn cm-btn-ghost text-sm"
          >
            ← Dashboard
          </Link>
          <RoleBadge role="admin" />
        </div>
      </header>

      <PostsWorkspace clinicId={clinic.id} posts={posts} />
    </main>
  )
}
