import Link from 'next/link'
import { redirect } from 'next/navigation'
import { loadClinicList } from '@/lib/supabase/context'
import { loadArsenal, loadUnresolvedIngests } from '@/lib/arsenal/store'
import { publicUrl } from '@/lib/arsenal/storage'
import { loadScriptTemplates } from '@/lib/posts/templates'
import { resolveAccess } from '@/lib/auth/session'
import { RoleBadge } from '@/app/components/RoleBadge'
import { PageHeader } from '@/app/components/PageHeader'
import { ArsenalWorkspace } from './components/ArsenalWorkspace'
import { TemplatesCanvas } from './components/TemplatesCanvas'

export const dynamic = 'force-dynamic'

// Single-page back-office for everything the writer's "library"
// touches: the ingest input (URL paste or drag-and-drop upload),
// the pending queue, the arsenal of extracted reference styles,
// the script_templates whiteboard, and the bot-chain map that
// shows where active templates feed into. One vertical stack —
// no tabs — so the operator can scan the whole flow at once.

interface ArsenalPageProps {
  searchParams: { clinicId?: string }
}

export default async function ArsenalPage({ searchParams }: ArsenalPageProps) {
  const access = await resolveAccess()
  if (!access) redirect('/')
  if (access.role !== 'admin') redirect('/dashboard')

  const clinics = await loadClinicList()
  if (clinics.length === 0) redirect('/onboarding')

  const clinicId = searchParams.clinicId ?? clinics[0].id
  const clinic = clinics.find((c) => c.id === clinicId) ?? clinics[0]

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

  // Templates link back to arsenal via the "arsenal:<style_label>"
  // naming convention used by saveArsenalAsTemplate. Map label → row
  // here so the canvas can show the source video preview alongside the
  // template's scaffold without an extra round-trip.
  const arsenalByLabel = new Map(decorated.map((a) => [a.style_label, a]))
  const templatesWithSource = templates.map((t) => {
    const labelMatch = t.name.startsWith('arsenal:')
      ? t.name.slice('arsenal:'.length)
      : null
    const source = labelMatch ? arsenalByLabel.get(labelMatch) ?? null : null
    return {
      template: t,
      source_arsenal_id: source?.id ?? null,
      source_video_url: source?.video_url ?? null,
      source_thumbnail_url: source?.thumbnail_url ?? null,
      source_style_description: source?.style_description ?? null,
    }
  })

  const activeTemplateCount = templates.filter((t) => t.active).length

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-8 px-5 py-8 cm-page-bg sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Back-office · Library"
        eyebrowColor="text-violet-500"
        title={`${clinic.name} · Script library`}
        subtitle="Drop a reference video → it becomes a clinic-tailored template the writer borrows from. Everything flows top to bottom."
        back={`/dashboard?clinicId=${clinic.id}`}
        right={<RoleBadge role="admin" />}
      />

      <nav className="flex flex-wrap items-center gap-2 -mt-4">
        <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
          {templates.length} template{templates.length === 1 ? '' : 's'} · {activeTemplateCount} active
        </span>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
          {decorated.length} entr{decorated.length === 1 ? 'y' : 'ies'}
        </span>
        {pendingQueue.length > 0 && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
            {pendingQueue.length} in queue
          </span>
        )}
      </nav>

      {/* 1. INGEST + ARSENAL workspace (URL/upload form, pending queue,
          extracted reference styles).
          ArsenalWorkspace itself renders the IngestUrlForm at top, the
          pending list, and arsenal cards. */}
      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-700">
          Reference arsenal — ingest + extracted styles
        </h2>
        <ArsenalWorkspace
          clinicId={clinic.id}
          initialRows={decorated}
          initialQueue={pendingQueue}
        />
      </section>

      {/* 2. TEMPLATES canvas — the scaffolds Writer actually reads. */}
      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-700">
          Templates — what the writer borrows from
        </h2>
        <TemplatesCanvas
          clinicId={clinic.id}
          initialTemplates={templatesWithSource}
        />
      </section>

    </main>
  )
}
