import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { resolveAccess } from '@/lib/auth/session'
import { seedStudioSlots, loadStudioSlots } from '@/lib/studio/slots'
import { llmAgentsEnabled } from '@/lib/agents/disabled'
import { Logomark } from '@/app/components/Logomark'
import { RoleBadge } from '@/app/components/RoleBadge'
import { StudioBoard } from './components/StudioBoard'

export const dynamic = 'force-dynamic'

interface StudioPageProps {
  searchParams: { clinicId?: string }
}

// Studio — the clinic film team's window. NOT admin-gated: doctors (and
// admins) land here from the dashboard. A horizontal board of columns,
// each pinned to a high-reach reference video with a generated shoot idea.
export default async function StudioPage({ searchParams }: StudioPageProps) {
  const access = await resolveAccess()
  if (!access) redirect('/')

  const clinicId =
    access.role === 'admin'
      ? searchParams.clinicId ?? null
      : access.clinicId
  if (!clinicId) {
    // Admin without a clinic selected — send them to pick one.
    redirect('/clinics')
  }

  const supabase = createServerClient()
  const { data: clinicRow } = await supabase
    .from('clinics')
    .select('name')
    .eq('id', clinicId)
    .maybeSingle()
  if (!clinicRow) redirect('/')

  // First visit seeds the board (top-reach videos + an idea each). Cheap
  // on later visits — persisted slots are read straight back. Seeding
  // swallows idea-gen errors (e.g. kill switch) so the page still renders.
  await seedStudioSlots(clinicId)
  const columns = await loadStudioSlots(clinicId)

  const inboxId = process.env.GOOGLE_DRIVE_CLIPS_INBOX_ID ?? null
  const driveInboxUrl = inboxId
    ? `https://drive.google.com/drive/folders/${inboxId}`
    : null

  const hasPool = columns.some((c) => c.arsenal_id)

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 cm-fade-in">
        <header className="flex flex-col gap-3 border-b border-neutral-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-sky-500">
              <Logomark size={18} />
              Content Machine · Studio
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-neutral-900 sm:text-4xl">
              🎬 What to film today
            </h1>
            <p className="mt-1 max-w-2xl text-base text-neutral-600">
              Each card = a format that&apos;s working right now. Watch the
              example, read who-says-what, film it. Swap the video or
              regenerate the idea any time.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/dashboard?clinicId=${clinicId}`}
              className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
            >
              ← Dashboard
            </Link>
            <RoleBadge
              role={access.role}
              doctorName={
                access.role !== 'admin' ? access.doctorName ?? null : null
              }
            />
          </div>
        </header>

        {!llmAgentsEnabled() && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Idea generation is paused in this build. You can still watch the
            reference videos; new ideas will appear once it&apos;s switched
            back on.
          </div>
        )}

        {!hasPool ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-12 text-center">
            <p className="text-lg font-medium text-neutral-800">
              No reference videos yet
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600">
              The board fills up once the marketing team adds a few
              high-performing example videos in the Library. Check back soon.
            </p>
          </div>
        ) : (
          <StudioBoard
            initialColumns={columns}
            clinicId={clinicId}
            isAdmin={access.role === 'admin'}
          />
        )}

        {driveInboxUrl && (
          <div className="mt-2 rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4">
            <p className="text-sm font-semibold text-sky-900">
              Done filming? Upload it here 👇
            </p>
            <p className="mt-1 text-sm text-sky-800">
              Drop your clips into the shared Google Drive inbox — the team
              picks them up from there.
            </p>
            <a
              href={driveInboxUrl}
              target="_blank"
              rel="noreferrer"
              className="cm-btn cm-btn-primary mt-3 inline-flex"
            >
              Open Drive inbox →
            </a>
          </div>
        )}
      </div>
    </main>
  )
}
