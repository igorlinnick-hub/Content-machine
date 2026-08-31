import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { syncFloorMedia } from '@/lib/floor/sync'
import { loadFloorMedia } from '@/lib/floor/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// "Sync now" — pull the clinic's Google-Form folder on demand. No push
// from here: whoever pressed the button is already looking at the
// gallery. The daily cron is the one that notifies.

export async function POST(req: Request) {
  const access = await resolveAccess()
  if (!access) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  // Admin only — the MA feed is not a doctor-facing surface.
  if (access.role !== 'admin') {
    return NextResponse.json({ error: 'admin only' }, { status: 403 })
  }

  const clinicId = new URL(req.url).searchParams.get('clinicId') ?? ''
  if (!clinicId) return NextResponse.json({ error: 'clinicId required' }, { status: 400 })

  try {
    const result = await syncFloorMedia({ clinicId, notify: false, prune: true })
    if (!result.configured) {
      return NextResponse.json(
        { error: 'No Drive folder connected for this clinic yet' },
        { status: 400 }
      )
    }
    if (result.access === 'denied') {
      return NextResponse.json(
        {
          error:
            "Drive returned nothing for this folder and won't open it either — the Google account Content Machine uses has no access. Share the folder with it (Editor), then sync again.",
        },
        { status: 400 }
      )
    }
    const items = await loadFloorMedia(clinicId)
    return NextResponse.json({
      ok: true,
      added: result.added.length,
      pruned: result.pruned,
      items,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
