import Link from 'next/link'
import { redirect } from 'next/navigation'
import { loadClinicList } from '@/lib/supabase/context'
import { loadArsenal, loadUnresolvedIngests } from '@/lib/arsenal/store'
import { publicUrl } from '@/lib/arsenal/storage'
import { loadScriptTemplates } from '@/lib/posts/templates'
import { resolveAccess } from '@/lib/auth/session'
import { RoleBadge } from '@/app/components/RoleBadge'
import { ArsenalWorkspace } from './components/ArsenalWorkspace'
import { TemplatesWorkspace } from './components/TemplatesWorkspace'

export const dynamic = 'force-dynamic'

// Admin-only back-office for the script_arsenal + script_templates.
// Doctors never land here — the page redirects them back to their
// dashboard. Two tabs share the page: Arsenal (ingested reference
// videos with hooks/structure/visual notes + refine chat) and
// Templates (the 6 seeded scaffolds + arsenal-derived snapshots).

interface ArsenalPageProps {
  searchParams: { clinicId?: string; tab?: string }
}

export default async function ArsenalPage({ searchParams }: ArsenalPageProps) {
  const access = await resolveAccess()
  if (!access) redirect('/')
  if (access.role !== 'admin') redirect('/dashboard')

  const clinics = await loadClinicList()
  if (clinics.length === 0) redirect('/onboarding')

  const clinicId = searchParams.clinicId ?? clinics[0].id
  const clinic = clinics.find((c) => c.id === clinicId) ?? clinics[0]
  const tab = searchParams.tab === 'templates' ? 'templates' : 'arsenal'

  const [arsenal, pendingQueue, templates] = await Promise.all([
    loadArsenal(clinic.id, { limit: 60 }),
    loadUnresolvedIngests(clinic.id, 15),
    loadScriptTemplates(clinic.id, { activeOnly: false }),
  ])

  // Decorate arsenal rows with derived public URLs so the client
  // never needs to know the bucket name. Cheap to compute server-side.
  const decorated = arsenal.map((a) => ({
    ...a,
    video_url: publicUrl(a.video_storage_path),
    thumbnail_url: publicUrl(a.thumbnail_storage_path),
  }))

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-5 py-6 sm:px-6 sm:py-8">
      <header className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-violet-500">
            Back-office
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-neutral-900">
            {clinic.name} · Script arsenal
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Reference scripts the writer borrows style from. Toggle off
            anything that stops working; save your favourites as templates.
          </p>
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
          href={`/arsenal?clinicId=${clinic.id}&tab=arsenal`}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            tab === 'arsenal'
              ? 'bg-violet-500 text-white'
              : 'text-neutral-700 hover:bg-neutral-100'
          }`}
        >
          📚 Arsenal
          <span className="ml-2 text-[11px] opacity-70">
            {arsenal.length}
            {pendingQueue.length > 0 ? ` (+${pendingQueue.length})` : ''}
          </span>
        </Link>
        <Link
          href={`/arsenal?clinicId=${clinic.id}&tab=templates`}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            tab === 'templates'
              ? 'bg-violet-500 text-white'
              : 'text-neutral-700 hover:bg-neutral-100'
          }`}
        >
          🧱 Templates
          <span className="ml-2 text-[11px] opacity-70">{templates.length}</span>
        </Link>
      </nav>

      {tab === 'templates' ? (
        <TemplatesWorkspace clinicId={clinic.id} initialTemplates={templates} />
      ) : (
        <ArsenalWorkspace
          clinicId={clinic.id}
          initialRows={decorated}
          initialQueue={pendingQueue}
        />
      )}
    </main>
  )
}
