import Link from 'next/link'
import { redirect } from 'next/navigation'
import { loadClinicList } from '@/lib/supabase/context'
import { loadPosts } from '@/lib/visual/store'
import { loadVideos } from '@/lib/videos/store'
import { resolveAccess } from '@/lib/auth/session'
import { PostsWorkspace } from './components/PostsWorkspace'
import { VideosWorkspace } from './components/VideosWorkspace'
import { RoleBadge } from '@/app/components/RoleBadge'

export const dynamic = 'force-dynamic'

interface VisualPageProps {
  searchParams: { clinicId?: string; tab?: string }
}

export default async function VisualPage({ searchParams }: VisualPageProps) {
  const access = await resolveAccess()
  if (!access) redirect('/')
  if (access.role !== 'admin') redirect('/dashboard')

  const clinics = await loadClinicList()
  if (clinics.length === 0) redirect('/onboarding')

  const clinicId = searchParams.clinicId ?? clinics[0].id
  const clinic = clinics.find((c) => c.id === clinicId) ?? clinics[0]
  const tab = searchParams.tab === 'videos' ? 'videos' : 'posts'

  const [posts, videos] = await Promise.all([
    loadPosts(clinic.id, 50),
    loadVideos(clinic.id, 50),
  ])

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
          <Link
            href={`/dashboard?clinicId=${clinic.id}`}
            className="cm-btn cm-btn-ghost text-sm"
          >
            ← Dashboard
          </Link>
          <RoleBadge role="admin" />
        </div>
      </header>

      <nav className="flex items-center gap-2 border-b border-neutral-200 pb-2">
        <Link
          href={`/visual?clinicId=${clinic.id}&tab=posts`}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            tab === 'posts'
              ? 'bg-sky-500 text-white'
              : 'text-neutral-700 hover:bg-neutral-100'
          }`}
        >
          📸 Posts
          <span className="ml-2 text-[11px] opacity-70">{posts.length}</span>
        </Link>
        <Link
          href={`/visual?clinicId=${clinic.id}&tab=videos`}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            tab === 'videos'
              ? 'bg-sky-500 text-white'
              : 'text-neutral-700 hover:bg-neutral-100'
          }`}
        >
          🎬 Videos
          <span className="ml-2 text-[11px] opacity-70">{videos.length}</span>
        </Link>
      </nav>

      {tab === 'videos' ? (
        <VideosWorkspace clinicId={clinic.id} videos={videos} />
      ) : (
        <PostsWorkspace clinicId={clinic.id} posts={posts} />
      )}
    </main>
  )
}
