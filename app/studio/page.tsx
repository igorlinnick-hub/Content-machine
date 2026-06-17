import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { resolveAccess } from '@/lib/auth/session'
import { listStudioVideos, studioScaffold } from '@/lib/studio/videos'
import { loadStudioIdea } from '@/lib/studio/slots'
import { llmAgentsEnabled } from '@/lib/agents/disabled'
import { Logomark } from '@/app/components/Logomark'
import { RoleBadge } from '@/app/components/RoleBadge'
import { StudioFunnel, type StudioCard } from './components/StudioFunnel'

export const dynamic = 'force-dynamic'

// Studio — the clinic film team's funnel. NOT admin-gated for viewing.
//   Discover  → like / skip candidate reels (open to all)
//   Liked     → team's picks; admin promotes to Shot List
//   Shot List → what we film; generate the shoot idea per video
export default async function StudioPage({
  searchParams,
}: {
  searchParams: { clinicId?: string; tab?: string }
}) {
  const access = await resolveAccess()
  if (!access) redirect('/')

  const clinicId =
    access.role === 'admin' ? searchParams.clinicId ?? null : access.clinicId
  if (!clinicId) redirect('/clinics')

  const supabase = createServerClient()
  const { data: clinicRow } = await supabase
    .from('clinics')
    .select('name')
    .eq('id', clinicId)
    .maybeSingle()
  if (!clinicRow) redirect('/')

  const isAdmin = access.role === 'admin'
  const all = await listStudioVideos(clinicId)

  // Map to a serialisable card; pin the pre-generated idea for Shot List.
  const cards: StudioCard[] = await Promise.all(
    all.map(async (v) => {
      const idea =
        v.status === 'shotlist'
          ? await loadStudioIdea(clinicId, v.current_script_id)
          : null
      return {
        id: v.id,
        status: v.status,
        account: v.author_handle,
        view_count: v.view_count,
        title: v.title,
        video_url: v.video_url,
        thumbnail_url: v.thumbnail_url,
        schema_beats: (v.structure?.beats ?? []).map((b) => ({
          name: b.name,
          text: b.text,
        })),
        template_scaffold: studioScaffold(v),
        idea,
      }
    })
  )

  const inboxId = process.env.GOOGLE_DRIVE_CLIPS_INBOX_ID ?? null
  const driveInboxUrl = inboxId
    ? `https://drive.google.com/drive/folders/${inboxId}`
    : null

  // Land on a stage that actually has content (Shot List first), unless the
  // URL asks for a specific tab.
  const explicit =
    searchParams.tab === 'liked' ||
    searchParams.tab === 'discover' ||
    searchParams.tab === 'shotlist'
      ? (searchParams.tab as 'liked' | 'discover' | 'shotlist')
      : null
  const has = (s: string) => cards.some((c) => c.status === s)
  const tab =
    explicit ??
    (has('shotlist')
      ? 'shotlist'
      : has('liked')
        ? 'liked'
        : 'discover')

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
              🎬 What to film
            </h1>
            <p className="mt-1 max-w-2xl text-base text-neutral-600">
              Like the reels that fit the clinic. The admin picks the final
              Shot List. Then generate a simple shoot idea for each — who says
              what, step by step.
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
              doctorName={access.role !== 'admin' ? access.doctorName ?? null : null}
            />
          </div>
        </header>

        {!llmAgentsEnabled() && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Idea generation is paused in this build. You can still browse and
            shortlist videos; ideas will generate once it&apos;s switched on.
          </div>
        )}

        <StudioFunnel
          clinicId={clinicId}
          isAdmin={isAdmin}
          initialTab={tab}
          initialCards={cards}
          driveInboxUrl={driveInboxUrl}
        />
      </div>
    </main>
  )
}
