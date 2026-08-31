import { NextResponse } from 'next/server'
import { listClinicsWithFloorFolder } from '@/lib/floor/store'
import { syncFloorMedia } from '@/lib/floor/sync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// A Drive listing plus a few inserts — nothing here encodes video, so
// the default ceiling is plenty.
export const maxDuration = 60

// Daily poll of every clinic's Google-Form upload folder ("From the
// floor"): mirror what the medical assistants uploaded into the app
// and send ONE aggregated push per clinic.
//
// Vercel cron: `0 7 * * *` = 21:00 Hawaii — after the shifts end, when
// the MAs have done their two-minutes-before-leaving upload.
//
// No LLM spend here, so unlike /api/cron/clips-inbox this route is NOT
// behind the ENABLE_LLM_AGENTS kill switch — turning agents off must
// not stop the team from seeing their own photos.

function checkAuth(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization') ?? ''
    if (auth === `Bearer ${cronSecret}`) return true
  }
  const internal = process.env.CONTENT_MACHINE_SECRET
  if (internal && req.headers.get('x-internal-dispatch-secret') === internal) {
    return true
  }
  return false
}

export async function GET(req: Request) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const clinics = await listClinicsWithFloorFolder()
  if (clinics.length === 0) {
    return NextResponse.json({
      ok: true,
      added: 0,
      results: [],
      hint: 'no clinic has a floor folder connected — poller is a no-op',
    })
  }

  const results: Array<Record<string, unknown>> = []
  let added = 0

  for (const clinic of clinics) {
    try {
      const r = await syncFloorMedia({
        clinicId: clinic.clinicId,
        notify: true,
        prune: true,
      })
      added += r.added.length
      results.push({
        ok: true,
        clinicId: clinic.clinicId,
        seen: r.seen,
        added: r.added.length,
        pruned: r.pruned,
      })
    } catch (e) {
      // One clinic's broken folder must not stop the others.
      results.push({
        ok: false,
        clinicId: clinic.clinicId,
        error: e instanceof Error ? e.message : 'unknown',
      })
    }
  }

  return NextResponse.json({ ok: true, added, results })
}
