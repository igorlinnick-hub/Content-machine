import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { llmAgentsEnabled } from '@/lib/agents/disabled'
import { createServerClient } from '@/lib/supabase/server'
import {
  listPhotoIndexForFolder,
  getPhotoOverrides,
} from '@/lib/visual/photo-index-store'
import {
  runPhotoMatcher,
  type PhotoCandidate,
} from '@/lib/agents/photo-matcher'
import { resolveEffectiveFolderId } from '@/lib/visual/folder'
import { getPhotosFromFolder } from '@/lib/google/drive'
import type { TypedSlide } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 30

interface Body {
  slideSetId?: string
  slideIndex?: number
  topN?: number
}

// POST → for the given slide in the given slide_set, return the top
// matching photos from the slide_set's drive folder photo_index.
// Caller passes slideIndex (0-based). Returns picks (best-first) AND
// the full description map so the UI can render the "All photos" grid
// from the same payload without a second round-trip.
export async function POST(req: Request) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }
  // Subscription mode (kill-switch on): the route stays usable — we
  // skip the AI matcher call but still hand back the raw Drive folder
  // contents so the team can pick photos manually. Frontend keys off
  // reason: 'llm_disabled' to show the right banner.
  const aiOn = llmAgentsEnabled()

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const slideSetId = body.slideSetId?.trim()
  const slideIndex = body.slideIndex
  if (!slideSetId || typeof slideIndex !== 'number' || slideIndex < 0) {
    return NextResponse.json(
      { error: 'slideSetId and slideIndex are required' },
      { status: 400 }
    )
  }

  const supabase = createServerClient()
  const { data: row, error } = await supabase
    .from('slide_sets')
    .select('clinic_id, slides')
    .eq('id', slideSetId)
    .maybeSingle()
  if (error || !row || !row.clinic_id) {
    return NextResponse.json({ error: 'slide_set not found' }, { status: 404 })
  }

  const slides = parseSlides(row.slides)
  if (slideIndex >= slides.length) {
    return NextResponse.json(
      { error: 'slideIndex out of range' },
      { status: 400 }
    )
  }
  const slide = slides[slideIndex]

  const folderId = await resolveEffectiveFolderId(slideSetId)
  if (!folderId) {
    return NextResponse.json(
      { error: 'no drive folder linked to this slide_set' },
      { status: 400 }
    )
  }

  // Always grab the raw Drive list — it's the subscription-mode
  // fallback AND the source for the exclude-list auto-cycle. Fail
  // soft: a Drive hiccup shouldn't 500 the picker.
  const driveList = await getPhotosFromFolder(folderId).catch(() => [])

  // photo_index lookup can throw if migration 019 hasn't been applied.
  // Translate to a friendly reason instead of a raw 500.
  let indexed: Awaited<ReturnType<typeof listPhotoIndexForFolder>> = []
  let indexErrorReason: string | null = null
  try {
    indexed = await listPhotoIndexForFolder(row.clinic_id, folderId)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'photo_index unavailable'
    const tableMissing = /does not exist|relation .* does not exist/i.test(msg)
    indexErrorReason = tableMissing
      ? 'migration_019_required'
      : 'photo_index_error'
  }

  // Build the candidate list the UI will render in the grid. Priority:
  //   1. photo_index rows (have AI descriptions) — preferred
  //   2. raw Drive photos (no description, just thumbnails) — fallback
  // so the picker is useful in subscription-only mode and even before
  // anyone has hit Re-index.
  type Candidate = {
    drive_file_id: string
    file_name: string | null
    description: string
    tags: string[]
  }

  const gridCandidates: Candidate[] =
    indexed.length > 0
      ? indexed.map((r) => ({
          drive_file_id: r.drive_file_id,
          file_name: r.file_name,
          description: r.description,
          tags: r.tags,
        }))
      : driveList.map((p) => ({
          drive_file_id: p.id,
          file_name: p.name,
          description: '',
          tags: [],
        }))

  // Reason taxonomy for the frontend banner.
  //   migration_019_required → red, "run the SQL"
  //   llm_disabled            → blue, "AI on pause, pick manually"
  //   no_photos_indexed       → amber, "Re-index folder to get suggestions"
  //   null                    → no banner (happy path)
  let reason: string | null = indexErrorReason
  if (!reason && !aiOn) reason = 'llm_disabled'
  if (!reason && indexed.length === 0 && driveList.length > 0) {
    reason = 'no_photos_indexed'
  }

  // Skip the matcher in subscription mode, when index is empty, or
  // when there are simply no photos in the folder. Either of those
  // returns the empty-picks shape and the UI degrades to the grid.
  if (!aiOn || indexed.length === 0) {
    return NextResponse.json({
      picks: [],
      candidates: gridCandidates,
      reason,
    })
  }

  const matcherCandidates: PhotoCandidate[] = indexed.map((r) => ({
    drive_file_id: r.drive_file_id,
    description: r.description,
    tags: r.tags,
  }))

  // Build the exclude list: every drive_file_id assigned to OTHER body/
  // cta slides in this post — both explicit overrides AND the auto-cycle
  // default. Effect: matcher never suggests a photo already in use,
  // operator never sees duplicates across the carousel.
  const overrides = await getPhotoOverrides(slideSetId)
  const driveCount = driveList.length
  const exclude = new Set<string>()
  for (let i = 0; i < slides.length; i += 1) {
    if (i === slideIndex) continue
    const s = slides[i]
    if (s.kind === 'cover') continue
    const ov = overrides[String(i)]
    if (ov) {
      exclude.add(ov)
      continue
    }
    if (driveCount > 0) {
      const auto = driveList[i % driveCount]?.id
      if (auto) exclude.add(auto)
    }
  }

  const matcher = await runPhotoMatcher({
    slide: {
      kind: slide.kind,
      chip: slide.chip ?? null,
      text: slide.text,
      subtext: slide.subtext ?? null,
    },
    postContext: null,
    candidates: matcherCandidates,
    topN: Math.max(1, Math.min(body.topN ?? 5, 10)),
    excludeFileIds: Array.from(exclude),
  })

  return NextResponse.json({
    picks: matcher.picks,
    candidates: gridCandidates,
    reason,
  })
}

function parseSlides(raw: unknown): TypedSlide[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((s): TypedSlide | null => {
      if (typeof s !== 'object' || s === null) return null
      const o = s as Record<string, unknown>
      const kind = o.kind === 'cover' || o.kind === 'body' || o.kind === 'cta' ? o.kind : 'body'
      const text = typeof o.text === 'string' ? o.text : ''
      return {
        kind,
        text,
        chip: typeof o.chip === 'string' ? o.chip : null,
        subtext: typeof o.subtext === 'string' ? o.subtext : null,
      }
    })
    .filter((s): s is TypedSlide => s !== null)
}
