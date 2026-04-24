import Link from 'next/link'
import { redirect } from 'next/navigation'
import { loadClinicList } from '@/lib/supabase/context'
import { loadPosts, loadStyleTemplate } from '@/lib/visual/store'
import { resolveAccess } from '@/lib/auth/session'
import { loadPlan } from '@/lib/posts/plan'
import { ContentPlan } from './components/ContentPlan'
import { PostsGallery } from './components/PostsGallery'
import { StyleEditor } from './components/StyleEditor'

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

  const [posts, style, plan] = await Promise.all([
    loadPosts(clinic.id, 30),
    loadStyleTemplate(clinic.id),
    loadPlan(clinic.id),
  ])

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-5 py-8 sm:px-6 sm:py-10">
      <header className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-orange-500">
            Posts workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-neutral-900">
            {clinic.name}
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Plan topics, generate carousel posts, download ZIPs.
          </p>
        </div>
        <Link
          href={`/dashboard?clinicId=${clinic.id}`}
          className="cm-btn cm-btn-ghost text-sm"
        >
          ← Dashboard
        </Link>
      </header>

      <ContentPlan clinicId={clinic.id} initialTopics={plan} />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Posts</h2>
        <PostsGallery posts={posts} />
      </section>

      <details className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm">
        <summary className="cursor-pointer font-medium text-neutral-700">
          Visual style template
        </summary>
        <div className="mt-4">
          <StyleEditor clinicId={clinic.id} initialStyle={style} />
        </div>
      </details>
    </main>
  )
}
