import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { disabledHttpResponse } from '@/lib/agents/disabled'
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
  const off = await disabledHttpResponse()
  if (off) return off

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

  // photo_index lookup can throw if migration 019 hasn't been applied
  // yet — translate to a friendly reason so the PhotoPicker UI can
  // tell the operator what to do instead of showing a raw 500.
  let indexed
  try {
    indexed = await listPhotoIndexForFolder(row.clinic_id, folderId)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'photo_index unavailable'
    const tableMissing = /does not exist|relation .* does not exist/i.test(msg)
    return NextResponse.json({
      picks: [],
      candidates: [],
      reason: tableMissing ? 'migration_019_required' : 'photo_index_error',
      error: tableMissing ? null : msg,
    })
  }
  if (indexed.length === 0) {
    return NextResponse.json({
      picks: [],
      candidates: [],
      reason: 'no_photos_indexed',
    })
  }

  const candidates: PhotoCandidate[] = indexed.map((r) => ({
    drive_file_id: r.drive_file_id,
    description: r.description,
    tags: r.tags,
  }))

  // Build the exclude list: every drive_file_id assigned to OTHER body/
  // cta slides in this post — both explicit overrides AND the auto-cycle
  // default for slides that don't have an override yet. Cover slides
  // never carry photos in the classic template, so they contribute
  // nothing. Effect: matcher never suggests a photo already in use,
  // operator never sees duplicates across the carousel.
  const overrides = await getPhotoOverrides(slideSetId)
  const driveList = await getPhotosFromFolder(folderId).catch(() => [])
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

  // Cover slides do not carry photos in the classic template — but we
  // still let the matcher run so a future cover layout that uses photos
  // doesn't need a new endpoint.
  const matcher = await runPhotoMatcher({
    slide: {
      kind: slide.kind,
      chip: slide.chip ?? null,
      text: slide.text,
      subtext: slide.subtext ?? null,
    },
    postContext: null,
    candidates,
    topN: Math.max(1, Math.min(body.topN ?? 5, 10)),
    excludeFileIds: Array.from(exclude),
  })

  return NextResponse.json({
    picks: matcher.picks,
    candidates: indexed.map((r) => ({
      drive_file_id: r.drive_file_id,
      file_name: r.file_name,
      description: r.description,
      tags: r.tags,
    })),
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
