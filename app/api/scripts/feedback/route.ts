import { NextResponse } from 'next/server'
import { saveScriptFeedback } from '@/lib/supabase/context'
import type { FeedbackAction } from '@/types'

export const runtime = 'nodejs'

interface FeedbackPostBody {
  clinicId: string
  scriptId: string
  action: FeedbackAction
  // When `selected`, the caller passes the other variants from the same
  // generation so we can auto-mark them `rejected` in the same call —
  // that's how the writer learns what the doctor consistently picks.
  siblingIds?: string[]
}

export async function POST(req: Request) {
  let body: FeedbackPostBody
  try {
    body = (await req.json()) as FeedbackPostBody
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  if (!body.clinicId || !body.scriptId) {
    return NextResponse.json(
      { error: 'clinicId and scriptId required' },
      { status: 400 }
    )
  }

  if (body.action !== 'selected' && body.action !== 'rejected') {
    return NextResponse.json(
      { error: 'action must be "selected" or "rejected"' },
      { status: 400 }
    )
  }

  const entries: Array<{ scriptId: string; action: FeedbackAction }> = [
    { scriptId: body.scriptId, action: body.action },
  ]

  if (body.action === 'selected' && Array.isArray(body.siblingIds)) {
    for (const sid of body.siblingIds) {
      if (typeof sid === 'string' && sid && sid !== body.scriptId) {
        entries.push({ scriptId: sid, action: 'rejected' })
      }
    }
  }

  try {
    const count = await saveScriptFeedback({
      clinicId: body.clinicId,
      entries,
    })
    return NextResponse.json({ saved: count })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
