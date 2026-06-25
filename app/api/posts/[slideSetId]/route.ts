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
    const { data: scriptRow } = slideSet.script_id
      ? await supabase
          .from('scripts')
          .select('topic, hook, full_script')
          .eq('id', slideSet.script_id)
          .maybeSingle()
      : { data: null }

    const { data: rrRow } = await supabase
      .from('slide_sets')
      .select('render_result, compliance, canva_style')
      .eq('id', slideSet.id)
      .maybeSingle()
    const render_result = (rrRow as { render_result?: Json | null } | null)
      ?.render_result ?? null
    const compliance = (rrRow as { compliance?: Json | null } | null)
      ?.compliance ?? null
    const canva_style = (rrRow as { canva_style?: number | null } | null)
      ?.canva_style ?? 1

    return NextResponse.json({
      slide_set_id: slideSet.id,
      clinic_id: slideSet.clinic_id,
      script_id: slideSet.script_id,
      topic: scriptRow?.topic ?? null,
      hook: scriptRow?.hook ?? null,
      script: scriptRow?.full_script ?? null,
      slides: slideSet.slides,
      previews: [],
      drive_folder_id: null,
      photo_overrides: {},
      created_at: slideSet.created_at,
      status: slideSet.status,
      render_result,
      compliance,
      canva_style,
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
  const canva_style = Number(body.canva_style)
  if (canva_style !== 1 && canva_style !== 2) {
    return NextResponse.json({ error: 'canva_style must be 1 or 2' }, { status: 400 })
  }
  const supabase = createServerClient()
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
