import { readFile } from 'fs/promises'
import path from 'path'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { marked } from 'marked'
import { resolveAccess } from '@/lib/auth/session'
import { RoleBadge } from '@/app/components/RoleBadge'

export const dynamic = 'force-dynamic'

interface ComplianceDoc {
  slug: 'ruleset' | 'playbook' | 'integration'
  label: string
  description: string
  file: string
}

const DOCS: ComplianceDoc[] = [
  {
    slug: 'ruleset',
    label: 'Ruleset v2.1',
    description: 'Machine-readable source of truth — rules that the AI critic + gate cite.',
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

interface PageProps {
  searchParams: { doc?: string }
}

export default async function CompliancePage({ searchParams }: PageProps) {
  // Same access gate as the rest of the back-office: admin OR a token
  // session (doctor/editor). Compliance is read-only — both team and
  // doctor should be able to read it, so we don't restrict by role.
  const access = await resolveAccess()
  if (!access) redirect('/')

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
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-5 py-6 sm:px-6 sm:py-8">
      <header className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-sky-500">
            Compliance
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-neutral-900">
            FDA / FTC ruleset
          </h1>
          <p className="mt-1 text-xs text-neutral-500">
            Every post the writer drafts is scored against this ruleset
            before it can reach Canva.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={dashboardHref} className="cm-btn cm-btn-ghost text-sm">
            ← Dashboard
          </Link>
          <RoleBadge role={access.role} />
        </div>
      </header>

      <nav className="flex flex-wrap gap-2">
        {DOCS.map((d) => {
          const isActive = d.slug === activeSlug
          return (
            <Link
              key={d.slug}
              href={`/compliance?doc=${d.slug}`}
              className={`flex flex-col rounded-lg border px-4 py-3 text-sm transition ${
                isActive
                  ? 'border-sky-300 bg-sky-50 text-sky-900'
                  : 'border-neutral-200 bg-white text-neutral-700 hover:border-sky-200 hover:bg-sky-50/50'
              }`}
            >
              <span className="font-semibold">{d.label}</span>
              <span className="text-[11px] text-neutral-500">{d.description}</span>
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
