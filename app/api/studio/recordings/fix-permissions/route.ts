import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { resolveAccess } from '@/lib/auth/session'
import { allowLinkView } from '@/lib/google/drive'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// One-shot repair: grant link-view to every existing recording and
// cleaned clip of a clinic so the in-app previews play. New files
// get the permission at creation; this covers the ones made before.

export async function POST(req: Request) {
  const access = await resolveAccess()
  if (!access) return NextResponse.json({ error: 'auth required' }, { status: 401 })
  if (access.role !== 'admin') {
    return NextResponse.json({ error: 'admin required' }, { status: 403 })
  }

  const clinicId = new URL(req.url).searchParams.get('clinicId') ?? ''
  if (!clinicId) return NextResponse.json({ error: 'clinicId required' }, { status: 400 })

  const supabase = createServerClient()
  const [{ data: recs }, { data: clips }] = await Promise.all([
    supabase
      .from('clinic_recordings')
      .select('drive_file_id')
      .eq('clinic_id', clinicId)
      .eq('status', 'final'),
    supabase
      .from('clips')
      .select('cleaned_file_id')
      .eq('clinic_id', clinicId)
      .eq('status', 'cleaned'),
  ])

  const ids = [
    ...(recs ?? []).map((r) => r.drive_file_id as string),
    ...(clips ?? []).map((c) => c.cleaned_file_id as string | null),
  ].filter((id): id is string => Boolean(id))

  let fixed = 0
  for (const id of ids) {
    try {
      await allowLinkView(id)
      fixed += 1
    } catch {
      // already shared / file gone — skip
    }
  }
  return NextResponse.json({ ok: true, total: ids.length, fixed })
}
