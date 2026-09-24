import { NextResponse } from 'next/server'
import { resolveAccess, type Access } from '@/lib/auth/session'
import {
  createIdeaNote,
  deleteIdeaNote,
  loadIdeaNote,
  loadIdeaNotes,
  updateIdeaNote,
  type TidyStatus,
} from '@/lib/notes/ideas'
import { noteTidyEnabled, tidyNote } from '@/lib/agents/note-tidy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Notes belong to the clinic: admin sees any, a doctor only their own.
function clinicAllowed(access: Access, clinicId: string): boolean {
  return access.role === 'admin' || access.clinicId === clinicId
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'unknown error'
}

export async function GET(req: Request) {
  const access = await resolveAccess()
  if (!access) return NextResponse.json({ error: 'authentication required' }, { status: 401 })

  const url = new URL(req.url)
  const clinicId = url.searchParams.get('clinicId')?.trim()
  if (!clinicId) {
    return NextResponse.json({ error: 'clinicId required' }, { status: 400 })
  }
  if (!clinicAllowed(access, clinicId)) {
    return NextResponse.json({ error: 'access denied' }, { status: 403 })
  }

  try {
    const notes = await loadIdeaNotes(clinicId, {
      archived: url.searchParams.get('archived') === 'true',
    })
    return NextResponse.json({ notes })
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 })
  }
}

interface CreateBody {
  clinicId?: string
  rawText?: string
  // Skip the tidy pass and save exactly what was typed.
  keepRaw?: boolean
}

export async function POST(req: Request) {
  const access = await resolveAccess()
  if (!access) return NextResponse.json({ error: 'authentication required' }, { status: 401 })

  let body: CreateBody
  try {
    body = (await req.json()) as CreateBody
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const clinicId = body.clinicId?.trim()
  const rawText = body.rawText?.trim()
  if (!clinicId || !rawText) {
    return NextResponse.json({ error: 'clinicId and rawText are required' }, { status: 400 })
  }
  if (!clinicAllowed(access, clinicId)) {
    return NextResponse.json({ error: 'access denied' }, { status: 403 })
  }

  try {
    // Tidy is best-effort: if the pass is off or throws, the note still
    // saves with the raw text and tidy_status says what happened.
    let tidied: Awaited<ReturnType<typeof tidyNote>> | null = null
    let tidyStatus: TidyStatus = 'raw'
    if (!body.keepRaw && noteTidyEnabled()) {
      try {
        tidied = await tidyNote(rawText)
        tidyStatus = 'tidied'
      } catch {
        tidyStatus = 'failed'
      }
    }

    const note = await createIdeaNote(clinicId, {
      rawBody: rawText,
      body: tidied?.body,
      title: tidied?.title ?? null,
      source: 'typed',
      tidyStatus,
      tidyFlags: tidied?.flags ?? [],
      tidyIssues: tidied?.issues ?? [],
    })
    return NextResponse.json({ note })
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 })
  }
}

interface PatchBody {
  noteId?: string
  title?: string | null
  body?: string
  // Resolving an uncertain word sends the new body together with the
  // remaining issues, so one tap is one request.
  tidyIssues?: { text: string; options: string[]; note?: string }[]
  pinned?: boolean
  archived?: boolean
  // 'revert' swaps body back to raw_body; 'retidy' runs the pass again
  // over raw_body (e.g. after the user extended the raw text elsewhere).
  action?: 'revert' | 'retidy'
}

export async function PATCH(req: Request) {
  const access = await resolveAccess()
  if (!access) return NextResponse.json({ error: 'authentication required' }, { status: 401 })

  let body: PatchBody
  try {
    body = (await req.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const noteId = body.noteId?.trim()
  if (!noteId) return NextResponse.json({ error: 'noteId required' }, { status: 400 })

  try {
    const existing = await loadIdeaNote(noteId)
    if (!existing) return NextResponse.json({ error: 'note not found' }, { status: 404 })
    if (!clinicAllowed(access, existing.clinic_id)) {
      return NextResponse.json({ error: 'access denied' }, { status: 403 })
    }

    if (body.action === 'revert') {
      const note = await updateIdeaNote(noteId, {
        body: existing.raw_body,
        tidyStatus: 'raw',
        tidyFlags: [],
        tidyIssues: [],
      })
      return NextResponse.json({ note })
    }

    if (body.action === 'retidy') {
      if (!noteTidyEnabled()) {
        return NextResponse.json({ error: 'LLM agents are disabled' }, { status: 409 })
      }
      const tidied = await tidyNote(existing.raw_body)
      const note = await updateIdeaNote(noteId, {
        title: existing.title ?? tidied.title,
        body: tidied.body,
        tidyStatus: 'tidied',
        tidyFlags: tidied.flags,
        tidyIssues: tidied.issues,
      })
      return NextResponse.json({ note })
    }

    const note = await updateIdeaNote(noteId, {
      title: body.title,
      // A manual edit makes the on-screen text the user's own again —
      // stale "couldn't read line 4" flags would point at text that may
      // no longer exist. A tap-resolve sends tidyIssues explicitly and
      // keeps the rest.
      ...(body.body !== undefined && body.tidyIssues === undefined
        ? { body: body.body, tidyFlags: [], tidyIssues: [] }
        : body.body !== undefined
          ? { body: body.body }
          : {}),
      tidyIssues: body.tidyIssues,
      pinned: body.pinned,
      archived: body.archived,
    })
    return NextResponse.json({ note })
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const access = await resolveAccess()
  if (!access) return NextResponse.json({ error: 'authentication required' }, { status: 401 })

  const url = new URL(req.url)
  const noteId = url.searchParams.get('noteId')?.trim()
  if (!noteId) return NextResponse.json({ error: 'noteId required' }, { status: 400 })

  try {
    const existing = await loadIdeaNote(noteId)
    if (!existing) return NextResponse.json({ ok: true })
    if (!clinicAllowed(access, existing.clinic_id)) {
      return NextResponse.json({ error: 'access denied' }, { status: 403 })
    }
    await deleteIdeaNote(noteId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 })
  }
}
