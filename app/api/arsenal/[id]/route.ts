import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { loadArsenalRow } from '@/lib/arsenal/store'
import { publicUrl } from '@/lib/arsenal/storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Single-row read for the back-office card detail view. The UI polls
// this after a refine request so it can update without a full reload.
// Returns the row + derived public URLs for the mp4/thumbnail so the
// client doesn't need to know the bucket name.

interface RouteContext {
  params: { id: string }
}

export async function GET(req: Request, { params }: RouteContext) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }
  const url = new URL(req.url)
  const clinicId = url.searchParams.get('clinicId')
  if (!clinicId) {
    return NextResponse.json({ error: 'clinicId required' }, { status: 400 })
  }
  const row = await loadArsenalRow(params.id, clinicId)
  if (!row) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  return NextResponse.json({
    row,
    video_url: publicUrl(row.video_storage_path),
    thumbnail_url: publicUrl(row.thumbnail_storage_path),
  })
}
