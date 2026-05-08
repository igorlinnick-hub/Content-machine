import Link from 'next/link'
import { redirect } from 'next/navigation'
import { loadClinicList, loadFewShotExamples } from '@/lib/supabase/context'
import { loadPosts } from '@/lib/visual/store'
import { loadPlan } from '@/lib/posts/plan'
import { ensureDefaultCategories } from '@/lib/posts/categories'
import { loadPostReferences } from '@/lib/posts/references'
import { loadScriptTemplates } from '@/lib/posts/templates'
import { resolveAccess } from '@/lib/auth/session'
import { PostsWorkspace } from './components/PostsWorkspace'
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

  const [posts, plan, categories, fewShot, references, templates] = await Promise.all([
    loadPosts(clinic.id, 50),
    loadPlan(clinic.id),
    ensureDefaultCategories(clinic.id),
    loadFewShotExamples(clinic.id),
    loadPostReferences(clinic.id).catch(() => []),
    loadScriptTemplates(clinic.id, { activeOnly: false }).catch(() => []),
  ])

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-5 py-6 sm:px-6 sm:py-8">
      <header className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-sky-500">
            Posts workspace
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-neutral-900">
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

      <PostsWorkspace
        clinicId={clinic.id}
        posts={posts}
        plan={plan}
        categories={categories}
        fewShot={fewShot.map((e) => ({
          id: e.id,
          script_text: e.script_text,
          why_good: e.why_good,
          topic: e.topic,
          score: e.score,
        }))}
        references={references}
        templates={templates.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          scaffold: t.scaffold,
          length_bias: t.length_bias,
          position: t.position,
          active: t.active,
        }))}
      />
    </main>
  )
}
