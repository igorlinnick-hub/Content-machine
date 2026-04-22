import Link from 'next/link'
import { redirect } from 'next/navigation'
import { loadClinicList, loadRecentScripts } from '@/lib/supabase/context'
import { loadRecentSlideSets, loadStyleTemplate } from '@/lib/visual/store'
import { SlideGenerator } from './components/SlideGenerator'
import { StyleEditor } from './components/StyleEditor'

export const dynamic = 'force-dynamic'

interface VisualPageProps {
  searchParams: { clinicId?: string }
}

export default async function VisualPage({ searchParams }: VisualPageProps) {
  const clinics = await loadClinicList()
  if (clinics.length === 0) redirect('/onboarding')

  const clinicId = searchParams.clinicId ?? clinics[0].id
  const clinic = clinics.find((c) => c.id === clinicId) ?? clinics[0]

  const [recentScripts, recentSets, style] = await Promise.all([
    loadRecentScripts(clinic.id, 10),
    loadRecentSlideSets(clinic.id, 8),
    loadStyleTemplate(clinic.id),
  ])

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-10 px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{clinic.name} · Instagram slides</h1>
          <p className="mt-1 text-sm text-neutral-500">
            This module is isolated — it only reads shipped scripts from the database.
          </p>
        </div>
        <Link
          href={`/dashboard?clinicId=${clinic.id}`}
          className="rounded border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700"
        >
          ← Dashboard
        </Link>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Generate slides from a script</h2>
        <SlideGenerator scripts={recentScripts} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Style template</h2>
        <StyleEditor clinicId={clinic.id} initialStyle={style} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Recent slide sets</h2>
        {recentSets.length === 0 ? (
          <p className="text-sm text-neutral-500">No slide sets yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-200 rounded border border-neutral-200 bg-white">
            {recentSets.map((s) => (
              <li key={s.id} className="flex items-center justify-between p-3 text-sm">
                <span className="truncate">
                  {s.slide_count} slides · {s.status} ·{' '}
                  {new Date(s.created_at).toLocaleString()}
                </span>
                <a
                  href={`/api/visual/download?slideSetId=${s.id}`}
                  className="shrink-0 rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50"
                >
                  Download ZIP
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
