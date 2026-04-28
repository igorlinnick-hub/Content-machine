import Link from 'next/link'
import { redirect } from 'next/navigation'
import { loadClinicList, loadFewShotExamples } from '@/lib/supabase/context'
import { loadPosts, loadStyleTemplate } from '@/lib/visual/store'
import { resolveAccess } from '@/lib/auth/session'
import { loadPlan } from '@/lib/posts/plan'
import { ensureDefaultCategories } from '@/lib/posts/categories'
import { ContentPlan } from './components/ContentPlan'
import { PostsGallery } from './components/PostsGallery'
import { StyleEditor } from './components/StyleEditor'
import { CategoriesEditor } from './components/CategoriesEditor'
import { FewShotEditor } from './components/FewShotEditor'
import { RoleBadge } from '@/app/components/RoleBadge'

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

  const [posts, style, plan, categories, fewShot] = await Promise.all([
    loadPosts(clinic.id, 30),
    loadStyleTemplate(clinic.id),
    loadPlan(clinic.id),
    ensureDefaultCategories(clinic.id),
    loadFewShotExamples(clinic.id),
  ])

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-5 py-8 sm:px-6 sm:py-10">
      <header className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-sky-500">
            Posts workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-neutral-900">
            {clinic.name}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard?clinicId=${clinic.id}`}
            className="cm-btn cm-btn-ghost text-sm"
          >
            ← Dashboard
          </Link>
          <RoleBadge role="admin" />
        </div>
      </header>

      <CategoriesEditor clinicId={clinic.id} initialCategories={categories} />

      <FewShotEditor clinicId={clinic.id} initialExamples={fewShot} />

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
