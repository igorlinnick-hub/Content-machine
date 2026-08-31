import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { describeFolder, parseDriveFolderId } from '@/lib/floor/drive'
import { loadFloorMedia, setFloorFolderId } from '@/lib/floor/store'
import { syncFloorMedia } from '@/lib/floor/sync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Connect (or disconnect) the Drive folder the clinic's Google Form
// writes into — the MA photo/clip uploads. Admin only: the clinic
// connects nothing, our team wires their folder, same white-label rule
// as the rest of the Drive plumbing.
//
// The paste is validated against Drive before it is stored, and the
// first sync runs inline, so a wrong link fails on the screen where it
// was typed instead of silently syncing nothing for a day.

export async function POST(req: Request) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json({ error: 'admin only' }, { status: 403 })
  }

  const url = new URL(req.url)
  const clinicId = url.searchParams.get('clinicId') ?? ''
  if (!clinicId) return NextResponse.json({ error: 'clinicId required' }, { status: 400 })

  let body: { folder?: string }
  try {
    body = (await req.json()) as { folder?: string }
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const folderId = parseDriveFolderId(body.folder ?? '')
  if (!folderId) {
    return NextResponse.json(
      { error: 'Paste a Drive folder link (…/drive/folders/…) or its id' },
      { status: 400 }
    )
  }

  const folder = await describeFolder(folderId)
  if (!folder) {
    return NextResponse.json(
      {
        error:
          "Drive can't open that folder. Check the id, and share the folder with the Google account Content Machine uses (Viewer is enough to read, Editor if you want the app to fix sharing).",
      },
      { status: 400 }
    )
  }

  try {
    await setFloorFolderId(clinicId, folder.id)
    const result = await syncFloorMedia({ clinicId, notify: false, prune: true })
    const items = await loadFloorMedia(clinicId)
    return NextResponse.json({
      ok: true,
      folder: { id: folder.id, name: folder.name },
      added: result.added.length,
      seen: result.seen,
      items,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json({ error: 'admin only' }, { status: 403 })
  }
  const clinicId = new URL(req.url).searchParams.get('clinicId') ?? ''
  if (!clinicId) return NextResponse.json({ error: 'clinicId required' }, { status: 400 })

  try {
    // Rows stay: the media is already in the app, and re-connecting
    // the same folder must not re-notify it as new.
    await setFloorFolderId(clinicId, null)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
