import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { resolveAccess } from '@/lib/auth/session'
import {
  allowLinkView,
  driveIdentity,
  readDownloadLock,
  restrictDownload,
} from '@/lib/google/drive'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// One-shot repair: grant link-view to every existing recording and
// cleaned clip of a clinic so the in-app previews play, and take the
// Download button away from link viewers (2026-09-10 — the doctor
// watches, we deliver the edit). New files get both at creation;
// this covers the ones made before. Safe to re-run.

export async function POST(req: Request) {
  const access = await resolveAccess()
  if (!access) return NextResponse.json({ error: 'auth required' }, { status: 401 })
  if (access.role !== 'admin') {
    return NextResponse.json({ error: 'admin required' }, { status: 403 })
  }

  const url = new URL(req.url)
  const clinicId = url.searchParams.get('clinicId') ?? ''
  if (!clinicId) return NextResponse.json({ error: 'clinicId required' }, { status: 400 })
  // Escape hatch: ?unlock=1 hands the Download button back to link
  // viewers on every file of this clinic. Here so the download lock can
  // be undone without a deploy if it ever gets in the way.
  const unlock = url.searchParams.get('unlock') === '1'

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

  // Per file: did the lock actually land? Read the flag back from Drive
  // instead of trusting the write — a swallowed error here is how the
  // first run reported success while the files stayed downloadable.
  const results: {
    id: string
    locked: boolean | null
    owner: string | null
    ownedByMe: boolean | null
    canChange: boolean | null
    shared: boolean
    error?: string
  }[] = []
  let fixed = 0
  for (const id of ids) {
    let shared = false
    try {
      await allowLinkView(id)
      shared = true
      fixed += 1
    } catch {
      // Already shared (create rejects a duplicate) or the file is gone —
      // the download flag below is the point of a re-run either way.
    }
    let error: string | undefined
    try {
      await restrictDownload(id, !unlock)
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }
    const state = await readDownloadLock(id).catch(() => null)
    results.push({
      id,
      locked: state?.locked ?? null,
      owner: state?.owner ?? null,
      ownedByMe: state?.ownedByMe ?? null,
      canChange: state?.canChange ?? null,
      shared,
      ...(error ? { error } : {}),
    })
  }
  const locked = results.filter((r) => r.locked === true).length
  const identity = await driveIdentity().catch(() => null)
  return NextResponse.json({
    ok: true,
    total: ids.length,
    fixed,
    locked,
    unlock,
    identity,
    results,
  })
}
