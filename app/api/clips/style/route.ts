import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { resolveAccess } from '@/lib/auth/session'
import {
  CAPTION_STYLES,
  DEFAULT_CAPTION_STYLE_KEY,
} from '@/lib/clips/captionStyles'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Clinic's caption style preset for the clips pipeline
// (HANDOFF §22.2 п.10). GET returns the current key; POST sets it.
// Admins pass ?clinicId=…, clinic sessions use their own clinic.

function resolveClinicId(
  access: { role: string; clinicId?: string },
  url: URL
): string {
  return access.role === 'admin'
    ? url.searchParams.get('clinicId') ?? ''
    : ((access as { clinicId: string }).clinicId ?? '')
}

export async function GET(req: Request) {
  const access = await resolveAccess()
  if (!access) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const clinicId = resolveClinicId(access, new URL(req.url))
  if (!clinicId) return NextResponse.json({ error: 'clinicId required' }, { status: 400 })

  const supabase = createServerClient()
  const { data } = await supabase
    .from('clinics')
    .select('caption_style')
    .eq('id', clinicId)
    .maybeSingle()

  return NextResponse.json({
    captionStyle:
      (data?.caption_style as string | null) ?? DEFAULT_CAPTION_STYLE_KEY,
  })
}

export async function POST(req: Request) {
  const access = await resolveAccess()
  if (!access) return NextResponse.json({ error: 'auth required' }, { status: 401 })
  // Style changes live in the admin-only video editor section.
  if (access.role !== 'admin') {
    return NextResponse.json({ error: 'admin required' }, { status: 403 })
  }

  const clinicId = resolveClinicId(access, new URL(req.url))
  if (!clinicId) return NextResponse.json({ error: 'clinicId required' }, { status: 400 })

  let body: { captionStyle?: string }
  try {
    body = (await req.json()) as { captionStyle?: string }
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const key = body.captionStyle ?? ''
  if (!CAPTION_STYLES.some((s) => s.key === key)) {
    return NextResponse.json(
      { error: `unknown captionStyle: ${key}` },
      { status: 400 }
    )
  }

  const supabase = createServerClient()
  const { error } = await supabase
    .from('clinics')
    .update({ caption_style: key })
    .eq('id', clinicId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, captionStyle: key })
}
