import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import { getDesign, listDesigns } from '@/lib/canva/api'
import type { Json } from '@/types/supabase'
import type { RenderResult } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 30

// GET /api/posts/:id/canva — redirect to a FRESH Canva edit URL.
//
// render_result.canva_edit_url is temporary (Canva expires edit links
// after ~30 days and ties them to the minting token), so clicking a
// stored link on an old post lands on Canva's 404 page. Resolution
// order for the stable design id:
//   1. render_result.canva_design_id (new rows — written by compose)
//   2. parse it out of a permanent stored URL (canva.com/design/<id>/…)
//   3. legacy rows: search designs by title — autofill titles every
//      design with the post topic — then backfill the id.
// Falls back to the stored URL only when Canva itself is unreachable.

const DESIGN_URL_RE = /canva\.com\/design\/([A-Za-z0-9_-]+)/

export async function GET(
  _req: Request,
  { params }: { params: { slideSetId: string } }
) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }

  const supabase = createServerClient()
  const { data: row, error } = await supabase
    .from('slide_sets')
    .select('id, render_result, scripts(topic)')
    .eq('id', params.slideSetId)
    .maybeSingle()
  if (error || !row) {
    return NextResponse.json(
      { error: error?.message ?? 'post not found' },
      { status: 404 }
    )
  }

  const rr = (row.render_result ?? null) as RenderResult | null
  if (!rr?.canva_edit_url && !rr?.canva_design_id) {
    return NextResponse.json(
      { error: 'post has no Canva design yet — compose it first' },
      { status: 404 }
    )
  }
  const scripts = Array.isArray(row.scripts) ? row.scripts[0] : row.scripts
  const topic =
    (scripts as { topic?: string | null } | null | undefined)?.topic ?? null

  let designId: string | null = rr.canva_design_id ?? null
  if (!designId && rr.canva_edit_url) {
    // Matches only permanent canva.com/design/<id> links — temporary
    // ones live under canva.com/api/design/<token> and stay unmatched.
    designId = DESIGN_URL_RE.exec(rr.canva_edit_url)?.[1] ?? null
  }

  try {
    if (!designId && topic) {
      const matches = await listDesigns(topic)
      const exact = matches.find((d) => d.title === topic)
      designId = (exact ?? matches[0])?.id ?? null
    }
    if (!designId) {
      return NextResponse.redirect(rr.canva_edit_url)
    }

    const design = await getDesign(designId)
    const freshUrl =
      design.editUrl ?? `https://www.canva.com/design/${designId}/edit`

    if (designId !== rr.canva_design_id) {
      // Best-effort backfill so the next click skips the lookup.
      await supabase
        .from('slide_sets')
        .update({
          render_result: { ...rr, canva_design_id: designId } as unknown as Json,
        })
        .eq('id', params.slideSetId)
    }
    return NextResponse.redirect(freshUrl)
  } catch (e) {
    // Canva unreachable / token stale — degrade to the stored URL so
    // the button still does something predictable.
    if (rr.canva_edit_url) return NextResponse.redirect(rr.canva_edit_url)
    const msg = e instanceof Error ? e.message : 'canva lookup failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
