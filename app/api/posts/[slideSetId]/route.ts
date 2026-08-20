import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import {
  deletePost,
  loadSlideSet,
  readSlidesJson,
} from '@/lib/visual/store'
import type { Json } from '@/types/supabase'
import type { TypedSlide } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 60

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

    const supabase = createServerClient()
    // Captions live on SCRIPTS (migration 013), not on slide_sets. They used
    // to be selected from slide_sets here, which 42703-failed the whole
    // select — and the silent null default meant every composed post kept
    // offering "Compose in Canva" while its render_result sat in the DB
    // (Igor hit this three times on 2026-08-19 before it was found).
    const { data: scriptRow } = slideSet.script_id
      ? await supabase
          .from('scripts')
          .select('topic, hook, full_script, long_caption, short_caption')
          .eq('id', slideSet.script_id)
          .maybeSingle()
      : { data: null }

    let { data: rrRow, error: rrErr } = await supabase
      .from('slide_sets')
      .select('render_result, compliance, canva_style, compose_progress')
      .eq('id', slideSet.id)
      .maybeSingle()
    if (rrErr?.code === '42703') {
      // Migration 045 (compose_progress) not applied yet — degrade.
      const retry = await supabase
        .from('slide_sets')
        .select('render_result, compliance, canva_style')
        .eq('id', slideSet.id)
        .maybeSingle()
      rrRow = retry.data as typeof rrRow
      rrErr = retry.error
    }
    if (rrErr) {
      // Never swallow this silently again: a failed select here nulls the
      // whole right-hand side of the UI (button, style, progress).
      console.error('[posts/:id] slide_sets meta select failed:', rrErr.code, rrErr.message)
    }
    const render_result = (rrRow as { render_result?: Json | null } | null)
      ?.render_result ?? null
    const compliance = (rrRow as { compliance?: Json | null } | null)
      ?.compliance ?? null
    const canva_style = (rrRow as { canva_style?: number | null } | null)
      ?.canva_style ?? 1
    const compose_progress = (rrRow as { compose_progress?: Json | null } | null)
      ?.compose_progress ?? null
    const long_caption = (scriptRow as { long_caption?: string | null } | null)
      ?.long_caption ?? null
    const short_caption = (scriptRow as { short_caption?: string | null } | null)
      ?.short_caption ?? null

    return NextResponse.json({
      slide_set_id: slideSet.id,
      clinic_id: slideSet.clinic_id,
      script_id: slideSet.script_id,
      // 'generating' placeholder rows have no script yet — the topic
      // lives in the stub cover slide until the pipeline lands.
      topic:
        scriptRow?.topic ??
        (slideSet.slides[0]?.kind === 'cover' ? slideSet.slides[0].text : null),
      hook: scriptRow?.hook ?? null,
      script: scriptRow?.full_script ?? null,
      long_caption,
      short_caption,
      slides: slideSet.slides,
      previews: [],
      drive_folder_id: null,
      photo_overrides: {},
      created_at: slideSet.created_at,
      status: slideSet.status,
      render_result,
      compliance,
      canva_style,
      compose_progress,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { slideSetId: string } }
) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }
  let body: { canva_style?: unknown }
  try {
    body = (await req.json()) as { canva_style?: unknown }
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }
  const supabase = createServerClient()
  const canva_style = Number(body.canva_style)
  // 1-5 map to the master style templates in lib/posts/style-templates.ts
  // (5 = Aesthetic, kept for Made). Keep this range in sync with that registry.
  if (!Number.isInteger(canva_style) || canva_style < 1 || canva_style > 5) {
    return NextResponse.json({ error: 'canva_style must be 1-5' }, { status: 400 })
  }
  const { error } = await supabase
    .from('slide_sets')
    .update({ canva_style })
    .eq('id', params.slideSetId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, canva_style })
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
    const supabase = createServerClient()
    const { error: updateError } = await supabase
      .from('slide_sets')
      .update({ slides: slides as unknown as Json })
      .eq('id', params.slideSetId)
    if (updateError) throw updateError

    return NextResponse.json({
      slide_set_id: params.slideSetId,
      slides,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
