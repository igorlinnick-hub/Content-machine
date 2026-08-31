import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { loadFloorMedia } from '@/lib/floor/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Minimal feed for the dashboard NewFloorBadge — upload times and kind
// only, no Drive ids.

export async function GET(req: Request) {
  const access = await resolveAccess()
  if (!access) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  // Admin only — the MA feed is not a doctor-facing surface.
  if (access.role !== 'admin') {
    return NextResponse.json({ error: 'admin only' }, { status: 403 })
  }

  const clinicId = new URL(req.url).searchParams.get('clinicId') ?? ''
  if (!clinicId) return NextResponse.json({ error: 'clinicId required' }, { status: 400 })

  try {
    const media = await loadFloorMedia(clinicId, 50)
    return NextResponse.json({
      media: media.map((m) => ({ id: m.id, kind: m.kind, uploaded_at: m.uploaded_at })),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
