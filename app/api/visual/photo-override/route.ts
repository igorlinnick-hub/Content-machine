import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { setPhotoOverride } from '@/lib/visual/photo-index-store'

export const runtime = 'nodejs'

interface Body {
  slideSetId?: string
  slideIndex?: number
  // null clears the override and reverts to auto-cycle.
  driveFileId?: string | null
}

// POST → persist the team's photo pick for a single slide. The render
// path (lib/visual/photos.ts) reads this on every render, so the next
// "Save & re-render" or download will pick up the new photo.
//
// Note: does NOT call any LLM, so it stays available under the kill
// switch — pure DB write.
export async function POST(req: Request) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const slideSetId = body.slideSetId?.trim()
  const slideIndex = body.slideIndex
  if (!slideSetId || typeof slideIndex !== 'number' || slideIndex < 0) {
    return NextResponse.json(
      { error: 'slideSetId and slideIndex are required' },
      { status: 400 }
    )
  }
  const fileId =
    body.driveFileId === null
      ? null
      : body.driveFileId?.trim()
        ? body.driveFileId.trim()
        : null

  try {
    const next = await setPhotoOverride(slideSetId, slideIndex, fileId)
    return NextResponse.json({ photo_overrides: next })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
