import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import {
  deletePost,
  loadSlideSet,
  loadScriptForRender,
  readSlidesJson,
} from '@/lib/visual/store'
import { renderSlides } from '@/lib/visual/renderer'
import { loadPhotoUrlsForSlideSet } from '@/lib/visual/photos'
import { getPhotoOverrides } from '@/lib/visual/photo-index-store'
import type { Json } from '@/types/supabase'
import type { TypedSlide } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function DELETE(
  _req: Request,
  { params }: { params: { slideSetId: string } }
) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }
  try {
    await deletePost(params.slideSetId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(
  _req: Request,
  { params }: { params: { slideSetId: string } }
) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }
  try {
    const slideSet = await loadSlideSet(params.slideSetId)
    const script = slideSet.script_id
      ? await loadScriptForRender(slideSet.script_id)
      : null

    const photoUrls = await loadPhotoUrlsForSlideSet(
      slideSet.id,
      slideSet.slides,
      slideSet.style_template
    )
    const buffers = slideSet.slides.length
      ? await renderSlides(
          slideSet.slides.map((s, i) => ({ slide: s, photoUrl: photoUrls[i] ?? null })),
          slideSet.style_template
        )
      : []
    const previews = buffers.map(
      (b) => `data:image/png;base64,${b.toString('base64')}`
    )

    // Resolve effective Drive folder for the PhotoPicker. Mirrors the
    // priority used by photos.ts (slide_set.drive_folder_id wins, then
    // category fallback) so the UI can re-index / browse the same
    // folder that the renderer is pulling from.
    let effectiveFolderId: string | null = slideSet.drive_folder_id ?? null
    if (!effectiveFolderId) {
      const supabase = createServerClient()
      const { data: catRow } = await supabase
        .from('slide_sets')
        .select('clinic_categories ( drive_folder_id )')
        .eq('id', slideSet.id)
        .maybeSingle()
      const cat = catRow
        ? Array.isArray(catRow.clinic_categories)
          ? catRow.clinic_categories[0]
          : catRow.clinic_categories
        : null
      effectiveFolderId =
        (cat as { drive_folder_id?: string | null } | null | undefined)
          ?.drive_folder_id ?? null
    }

    const photoOverrides = await getPhotoOverrides(slideSet.id)

    return NextResponse.json({
      slide_set_id: slideSet.id,
      clinic_id: slideSet.clinic_id,
      script_id: slideSet.script_id,
      topic: script?.topic ?? null,
      hook: script?.hook ?? null,
      script: script?.full_script ?? null,
      slides: slideSet.slides,
      previews,
      created_at: slideSet.created_at,
      status: slideSet.status,
      drive_folder_id: effectiveFolderId,
      photo_overrides: photoOverrides,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

interface PutBody {
  slides?: unknown
}

export async function PUT(
  req: Request,
  { params }: { params: { slideSetId: string } }
) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }

  let body: PutBody
  try {
    body = (await req.json()) as PutBody
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  // Support both legacy string[] (from textarea edits) and TypedSlide[] (full
  // structure) on PUT. Strings get coerced to typed by position.
  const incoming = readSlidesJson(body.slides)
  if (incoming.length === 0) {
    return NextResponse.json(
      { error: 'at least one non-empty slide is required' },
      { status: 400 }
    )
  }
  const slides: TypedSlide[] = incoming.map((s, i, arr) => {
    if (i === 0) return { ...s, kind: 'cover' }
    if (i === arr.length - 1) return { ...s, kind: 'cta' }
    return { ...s, kind: 'body' }
  })

  try {
    const slideSet = await loadSlideSet(params.slideSetId)

    const supabase = createServerClient()
    const { error: updateError } = await supabase
      .from('slide_sets')
      .update({ slides: slides as unknown as Json, status: 'rendered' })
      .eq('id', params.slideSetId)
    if (updateError) throw updateError

    const photoUrls = await loadPhotoUrlsForSlideSet(
      params.slideSetId,
      slides,
      slideSet.style_template
    )
    const buffers = await renderSlides(
      slides.map((s, i) => ({ slide: s, photoUrl: photoUrls[i] ?? null })),
      slideSet.style_template
    )
    const previews = buffers.map(
      (b) => `data:image/png;base64,${b.toString('base64')}`
    )

    return NextResponse.json({
      slide_set_id: params.slideSetId,
      slides,
      previews,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
