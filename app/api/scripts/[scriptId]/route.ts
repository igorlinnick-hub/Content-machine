import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { resolveAccess } from '@/lib/auth/session'
import { runComplianceGate } from '@/lib/posts/pipeline'
import {
  MANUAL_SOURCE,
  deriveHook,
  gateRan,
  gradedText,
  starBlockReason,
  wordCount,
} from '@/lib/scripts/manual'
import { nicheIsScreened } from '@/lib/niche/profiles'
import type { ComplianceResult } from '@/types'
import type { Json } from '@/types/supabase'

export const runtime = 'nodejs'
// A text edit on a row that carries a verdict re-runs the gate (~5-20 s).
export const maxDuration = 60

interface PatchBody {
  topic?: string
  hook?: string | null
  full_script?: string
  starred?: boolean
}

/**
 * Edit a saved script in place: text, title/hook, or the star flag.
 * `full_script` is stored RAW (slide markup intact) — the reading
 * surfaces clean it at display time, the carousel splitter needs it.
 *
 * Rows that carry a compliance verdict (hand-added, Studio) are re-graded
 * whenever the spoken text changes — a verdict must describe the text it
 * sits on. Starring is refused while the verdict blocks (REMOVE/REWORD)
 * or a hand-added script is ungraded: the star is what puts a script on
 * the doctor's list.
 */
export async function PATCH(
  req: Request,
  { params }: { params: { scriptId: string } }
) {
  const access = await resolveAccess()
  if (!access) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const { scriptId } = params
  if (!scriptId) return NextResponse.json({ error: 'scriptId required' }, { status: 400 })

  const body = (await req.json().catch(() => null)) as PatchBody | null
  if (!body) return NextResponse.json({ error: 'invalid body' }, { status: 400 })

  const supabase = createServerClient()

  const { data: script } = await supabase
    .from('scripts')
    .select('id, clinic_id, topic, hook, full_script, source, compliance')
    .eq('id', scriptId)
    .single()

  if (!script) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (access.role !== 'admin' && script.clinic_id !== access.clinicId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const patch: {
    starred?: boolean
    topic?: string
    hook?: string | null
    full_script?: string
    word_count?: number
    updated_at?: string
    compliance?: Json | null
  } = {}

  if (typeof body.starred === 'boolean') patch.starred = body.starred

  if (typeof body.topic === 'string') {
    const topic = body.topic.trim()
    if (!topic) return NextResponse.json({ error: 'topic cannot be empty' }, { status: 400 })
    patch.topic = topic
  }

  if (body.hook !== undefined) {
    const hook = typeof body.hook === 'string' ? body.hook.trim() : ''
    patch.hook = hook || null
  }

  if (typeof body.full_script === 'string') {
    const text = body.full_script.trim()
    if (!text) return NextResponse.json({ error: 'script cannot be empty' }, { status: 400 })
    patch.full_script = text
    patch.word_count = wordCount(text)
    // A hand-written script's hook is its first line, same as on create.
    // Without this a body edit leaves the old opening behind — and the
    // gate keeps grading (and flagging) a line that is no longer there.
    if (script.source === MANUAL_SOURCE && body.hook === undefined) {
      patch.hook = deriveHook(text)
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
  }

  // Stamp updated_at only on content edits — starring isn't an edit.
  // The critic score is left as-is: it graded the original draft, and
  // the UI marks hand-edited scripts so the number can be read in context.
  const contentEdit =
    'full_script' in patch || 'topic' in patch || 'hook' in patch
  if (contentEdit) patch.updated_at = new Date().toISOString()

  let compliance = (script.compliance as unknown as ComplianceResult | null) ?? null
  const tracksCompliance = script.source === MANUAL_SOURCE || compliance !== null
  const nextHook = 'hook' in patch ? (patch.hook ?? null) : script.hook
  const nextBody = patch.full_script ?? script.full_script
  const nextSpoken = gradedText(nextHook, nextBody)
  const regrade =
    tracksCompliance && nextSpoken !== gradedText(script.hook, script.full_script)

  // The niche decides whether the gate applies at all (HireDrop: no).
  // Only looked up when a regrade or a star actually needs it.
  let niche: string | null = null
  if (regrade || patch.starred === true) {
    const { data: clinic } = await supabase
      .from('clinics')
      .select('niche')
      .eq('id', script.clinic_id ?? '')
      .single()
    niche = clinic?.niche ?? null
  }
  const screened = nicheIsScreened(niche)

  if (regrade && screened) {
    const graded = await runComplianceGate({
      script: nextSpoken,
      topic: patch.topic ?? script.topic,
      niche,
    }).catch(() => null)
    // A failed check leaves the row ungraded rather than wearing the
    // verdict of text it no longer has. The edit itself still saves —
    // a doctor fixing a line mid-shoot must not lose it to a gate outage.
    compliance = graded && gateRan(graded) ? graded : null
    patch.compliance = compliance as unknown as Json
  }

  if (patch.starred === true) {
    const reason = starBlockReason({ source: script.source, compliance }, screened)
    if (reason) return NextResponse.json({ error: reason }, { status: 409 })
  }

  const { data: updated, error } = await supabase
    .from('scripts')
    .update(patch)
    .eq('id', scriptId)
    .select('id, topic, hook, full_script, word_count, starred, updated_at, source, compliance')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, script: updated })
}

export async function DELETE(
  _req: Request,
  { params }: { params: { scriptId: string } }
) {
  const access = await resolveAccess()
  if (!access) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const { scriptId } = params
  if (!scriptId) return NextResponse.json({ error: 'scriptId required' }, { status: 400 })

  const supabase = createServerClient()

  // Verify the script belongs to a clinic this user can access
  const { data: script } = await supabase
    .from('scripts')
    .select('id, clinic_id')
    .eq('id', scriptId)
    .single()

  if (!script) return NextResponse.json({ error: 'not found' }, { status: 404 })

  if (access.role !== 'admin' && script.clinic_id !== access.clinicId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { error } = await supabase.from('scripts').delete().eq('id', scriptId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
