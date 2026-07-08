import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { loadRecentClips } from '@/lib/clips/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Minimal recent-clips feed for the dashboard NewClipsBadge —
// status + completion time only, no Drive ids.

export async function GET(req: Request) {
  const access = await resolveAccess()
  if (!access) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const url = new URL(req.url)
  const clinicId =
    access.role === 'admin'
      ? url.searchParams.get('clinicId') ?? ''
      : access.clinicId
  if (!clinicId) return NextResponse.json({ error: 'clinicId required' }, { status: 400 })

  try {
    const clips = await loadRecentClips(clinicId, 20)
    return NextResponse.json({
      clips: clips.map((c) => ({
        id: c.id,
        status: c.status,
        completed_at: c.completed_at,
      })),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
