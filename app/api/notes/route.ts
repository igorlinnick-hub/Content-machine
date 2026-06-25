import { NextResponse } from 'next/server'
import { runAnalyst } from '@/lib/agents/analyst'
import { llmAgentsEnabled } from '@/lib/agents/disabled'
import { saveDoctorNote, markNoteProcessed } from '@/lib/supabase/context'
import { resolveAccess } from '@/lib/auth/session'
import type { NoteSource } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 60

interface NotesPostBody {
  clinicId: string
  rawText: string
  source?: NoteSource
}

export async function POST(req: Request) {
  const access = await resolveAccess()
  if (!access) return NextResponse.json({ error: 'authentication required' }, { status: 401 })

  let body: NotesPostBody
  try {
    body = (await req.json()) as NotesPostBody
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const clinicId = body.clinicId?.trim()
  const rawText = body.rawText?.trim()
  if (!clinicId || !rawText) {
    return NextResponse.json(
      { error: 'clinicId and rawText are required' },
      { status: 400 }
    )
  }
  if (access.role !== 'admin' && ('clinicId' in access) && access.clinicId !== clinicId) {
    return NextResponse.json({ error: 'access denied' }, { status: 403 })
  }

  try {
    const note = await saveDoctorNote(clinicId, {
      rawText,
      source: body.source ?? 'widget',
    })

    // Subscription-only mode: save the raw note but skip the analyst
    // pass — the row sits in doctor_notes with processed=false, ready
    // to be picked up once ENABLE_LLM_AGENTS flips on. No data lost.
    if (!llmAgentsEnabled()) {
      return NextResponse.json({
        noteId: note.id,
        insights_saved: 0,
        analyst: null,
        deferred: 'LLM_AGENTS_DISABLED',
      })
    }

    const { output, insights } = await runAnalyst({ clinicId, rawText, persist: true })
    await markNoteProcessed(note.id)

    return NextResponse.json({
      noteId: note.id,
      insights_saved: insights.length,
      analyst: output,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
