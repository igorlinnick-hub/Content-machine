import { readFile } from 'fs/promises'
import path from 'path'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { marked } from 'marked'
import { resolveAccess } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import { RoleBadge } from '@/app/components/RoleBadge'
import { PageHeader } from '@/app/components/PageHeader'

export const dynamic = 'force-dynamic'

interface ComplianceDoc {
  slug: 'ruleset' | 'playbook' | 'integration'
  label: string
  description: string
  file: string
}

// Docs shown to regenmed clinics (the default).
const DOCS_REGENMED: ComplianceDoc[] = [
  {
    slug: 'ruleset',
    label: 'Ruleset v2.1',
    description: 'Machine-readable source of truth — rules the AI critic + gate cite.',
    file: 'docs/compliance-ruleset.md',
  },
  {
    slug: 'playbook',
    label: 'Plain-language playbook',
    description: 'Do / don\'t cheat sheet for marketers and writers.',
    file: 'docs/compliance-playbook.md',
  },
  {
    slug: 'integration',
    label: 'Integration brief',
    description: 'How the gate is wired into the pipeline (Writer → Critic → Gate).',
    file: 'docs/COMPLIANCE-INTEGRATION.md',
  },
]

// Docs shown to aesthetics clinics — no exosome/stem-cell/regenmed rules.
const DOCS_AESTHETICS: ComplianceDoc[] = [
  {
    slug: 'ruleset',
    label: 'Ruleset v1.0 — Aesthetics',
    description: 'Rules for Botox / fillers / skin treatments. Applied by the AI gate before publish.',
    file: 'docs/compliance-ruleset-aesthetics.md',
  },
  {
    slug: 'playbook',
    label: 'Plain-language playbook',
    description: 'Do / don\'t cheat sheet for marketers and writers.',
    file: 'docs/compliance-playbook.md',
  },
  {
    slug: 'integration',
    label: 'Integration brief',
    description: 'How the gate is wired into the pipeline (Writer → Critic → Gate).',
    file: 'docs/COMPLIANCE-INTEGRATION.md',
  },
]

interface PageProps {
  searchParams: { doc?: string }
}

export default async function CompliancePage({ searchParams }: PageProps) {
  const access = await resolveAccess()
  if (!access) redirect('/')

  // Resolve niche for the current clinic so we can serve the right ruleset.
  // Admin sees regenmed docs by default (they can switch ?clinicId to preview another).
  let niche = 'regenerative_medicine'
  const clinicId = access.role === 'admin' ? null : ('clinicId' in access ? access.clinicId : null)
  if (clinicId) {
    try {
      const supabase = createServerClient()
      const { data } = await supabase.from('clinics').select('niche').eq('id', clinicId).single()
      if (data?.niche) niche = data.niche
    } catch { /* fallback to regenmed */ }
  }

  const DOCS = niche === 'aesthetics' ? DOCS_AESTHETICS : DOCS_REGENMED

  const activeSlug = (DOCS.find((d) => d.slug === searchParams.doc)?.slug ?? 'ruleset') as ComplianceDoc['slug']
  const active = DOCS.find((d) => d.slug === activeSlug)!

  let html = ''
  let loadError: string | null = null
  try {
    const filepath = path.join(process.cwd(), active.file)
    const raw = await readFile(filepath, 'utf-8')
    html = await marked.parse(raw, { gfm: true, breaks: false })
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'failed to load'
  }

  const dashboardHref =
    access.role === 'admin'
      ? '/dashboard'
      : `/dashboard?clinicId=${access.clinicId}`

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-5 py-8 cm-page-bg sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Compliance"
        eyebrowColor="text-amber-500"
        title="FDA / FTC Ruleset"
        subtitle="Every post the writer drafts is scored against this ruleset before it can reach Canva."
        back={dashboardHref}
        right={<RoleBadge role={access.role} />}
      />

      <nav className="flex flex-wrap gap-2 -mt-2">
        {DOCS.map((d) => {
          const isActive = d.slug === activeSlug
          return (
            <Link
              key={d.slug}
              href={`/compliance?doc=${d.slug}`}
              className={`flex flex-col rounded-xl border px-4 py-3 text-sm transition-all ${
                isActive
                  ? 'border-sky-300 bg-sky-50 text-sky-900 shadow-sm'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:border-sky-200 hover:bg-sky-50/50 hover:shadow-sm'
              }`}
            >
              <span className="font-semibold">{d.label}</span>
              <span className="mt-0.5 text-[11px] text-neutral-500">{d.description}</span>
            </Link>
          )
        })}
      </nav>

      <article className="cm-doc rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8">
        {loadError ? (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Could not load <code>{active.file}</code>: {loadError}
          </p>
        ) : (
          <div
            // Server-rendered from the in-repo .md files committed by the
            // compliance team — no user input ever reaches this html.
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </article>

      <footer className="text-xs text-neutral-500">
        Source files live under <code>docs/</code> in the repo. Edits to those
        files reflect here on the next deploy.
      </footer>
    </main>
  )
}
