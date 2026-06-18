import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// POST /api/studio/videos/add-format  { clinicId, title, description }
// Admin only. Creates a clinic b-roll format card (no video URL required).
// Lands straight on the Shot List with shot_type='clinic'.
export async function POST(req: Request) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin')
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })

  const body = (await req.json().catch(() => ({}))) as {
    clinicId?: string
    title?: string
    description?: string
  }
  const { clinicId, title, description } = body
  if (!clinicId || !title?.trim())
    return NextResponse.json({ error: 'clinicId and title required' }, { status: 400 })

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('studio_videos')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({
      clinic_id: clinicId,
      title: title.trim(),
      style_description: description?.trim() ?? null,
      shot_type: 'clinic',
      status: 'shotlist',
      is_active: true,
      source_platform: 'manual',
      structure: {},
    } as any)
    .select('id')
    .maybeSingle()

  if (error || !data)
    return NextResponse.json({ ok: false, error: error?.message ?? 'insert failed' }, { status: 500 })

  return NextResponse.json({ ok: true, id: data.id })
}
