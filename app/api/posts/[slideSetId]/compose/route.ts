import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Compose a slide_set into a real Canva design.
//
// Current state: STUB. Steps 5-7 of the Canva integration plan will
// replace the placeholder URL with a real pipeline:
//   1. Read slide_set.slides (PostPlan JSONB) + photo_brief
//   2. For each photo_brief.source='ai': call Replicate Flux Pro to
//      generate the photo; upload bytes to Canva as an asset
//   3. For each photo_brief.source='drive': resolve drive_file_id
//      from the clinic_categories drive_folder_id + clinic library
//   4. createDesignFromTemplate(HWC brand-template) with field
//      mappings from PostPlan (cover.title, slides[].heading, etc.)
//   5. Save design URL + flip compose_status to 'ready'
//
// Until then this endpoint marks the row as 'queued' → 'ready' with
// a placeholder URL, so the UI can show the loading → success states
// end-to-end. The marketer sees how the flow will look the moment
// the real wire-up lands. Stub never fires Replicate / Canva quota.
export async function POST(
  _req: Request,
  { params }: { params: { slideSetId: string } }
) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }

  const supabase = createServerClient()

  // Load the row first so we can refuse early if the slide_set is in
  // a bad state (blocked, deleted, missing photo_brief).
  const { data: row, error: loadErr } = await supabase
    .from('slide_sets')
    .select('id, status, slides, compose_status')
    .eq('id', params.slideSetId)
    .maybeSingle()
  if (loadErr || !row) {
    return NextResponse.json(
      { error: `slide_set not found: ${loadErr?.message ?? 'no row'}` },
      { status: 404 }
    )
  }
  if (row.status === 'blocked') {
    return NextResponse.json(
      { error: 'cannot compose a blocked post — fix the compliance findings first' },
      { status: 409 }
    )
  }

  // Mark queued so the UI button can flip to "Composing…" immediately.
  await supabase
    .from('slide_sets')
    .update({ compose_status: 'queued', compose_error: null })
    .eq('id', params.slideSetId)

  // ── STUB PATH ─────────────────────────────────────────────────
  // Replace this block once steps 5-7 land. For now we synthesize a
  // deterministic placeholder so the UI roundtrip is testable.
  const placeholderUrl = `https://www.canva.com/design/placeholder-${params.slideSetId.slice(0, 8)}/edit`
  await supabase
    .from('slide_sets')
    .update({
      compose_status: 'ready',
      canva_design_url: placeholderUrl,
    })
    .eq('id', params.slideSetId)
  return NextResponse.json({
    ok: true,
    stub: true,
    canva_design_url: placeholderUrl,
    compose_status: 'ready',
  })
}
