import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { resolveAccess } from '@/lib/auth/session'
import { listStudioVideos, studioScaffold } from '@/lib/studio/videos'
import { loadStudioIdea } from '@/lib/studio/slots'
import { llmAgentsEnabled } from '@/lib/agents/disabled'
import { RoleBadge } from '@/app/components/RoleBadge'
import { PageHeader } from '@/app/components/PageHeader'
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
        shot_type: v.shot_type ?? 'doctor',
        account: v.author_handle,
        view_count: v.view_count,
        title: v.title,
        style_description: v.style_description,
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

  // The shared Drive folder where the team uploads finished clips. Pinned
  // in the header so staff can always find it. Override via env if needed.
  const driveInboxUrl =
    process.env.NEXT_PUBLIC_DRIVE_UPLOAD_URL ??
    'https://drive.google.com/drive/folders/1erhf5AURtETtyXUlnskCNiSVUvD_JfKJ?usp=share_link'

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
    <main className="min-h-screen cm-page-bg">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <PageHeader
          eyebrow="Content Machine · Studio"
          title="What to film"
          subtitle="Like the reels that fit the clinic. The admin picks the final Shot List. Then generate a shoot idea for each."
          back={`/dashboard?clinicId=${clinicId}`}
          right={
            <>
              <a
                href={driveInboxUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-600"
              >
                📁 Upload folder
              </a>
              <RoleBadge
                role={access.role}
                doctorName={access.role !== 'admin' ? access.doctorName ?? null : null}
              />
            </>
          }
        />

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
