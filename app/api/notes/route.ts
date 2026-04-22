import { NextResponse } from 'next/server'
import { runAnalyst } from '@/lib/agents/analyst'
import { saveDoctorNote, markNoteProcessed } from '@/lib/supabase/context'
import type { NoteSource } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 60

interface NotesPostBody {
  clinicId: string
  rawText: string
  source?: NoteSource
}

export async function POST(req: Request) {
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

  try {
    const note = await saveDoctorNote(clinicId, {
      rawText,
      source: body.source ?? 'widget',
    })

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
