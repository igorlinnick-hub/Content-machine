import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { resolveAccess } from '@/lib/auth/session'
import { runComplianceGate } from '@/lib/posts/pipeline'
import { convergeCompliance } from '@/lib/agents/compliance-loop'
import { deriveHook, gateRan, gradedText, wordCount } from '@/lib/scripts/manual'
import type { ComplianceResult } from '@/types'
import type { Json } from '@/types/supabase'

export const runtime = 'nodejs'
// 'fix' runs the full rewrite → regrade loop: up to 3 rounds of two Opus
// calls each, same budget as generation.
export const maxDuration = 300

const RETURN_COLS =
  'id, topic, hook, full_script, word_count, starred, updated_at, source, compliance'

interface PostBody {
  action?: 'check' | 'fix'
}

interface ScriptPatch {
  compliance: Json | null
  full_script?: string
  hook?: string | null
  word_count?: number
  updated_at?: string
}

/**
 * The compliance controls on a saved script (admin only).
 *
 *   check — grade the current text again. For a row whose last check did
 *           not run (gate outage during an edit) or predates a rule change.
 *   fix   — the same rewrite → regrade loop generation uses
 *           (convergeCompliance): flagged wording is rewritten, the rest of
 *           the text is left alone, and the final verdict is the real one.
 *           The new text is saved straight away — the person asked for it,
 *           and the modal shows it for a read-through. REMOVE is not
 *           offered: the claim itself is the problem, wording cannot fix it.
 */
export async function POST(
  req: Request,
  { params }: { params: { scriptId: string } }
) {
  const access = await resolveAccess()
  if (!access) return NextResponse.json({ error: 'auth required' }, { status: 401 })
  if (access.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = (await req.json().catch(() => null)) as PostBody | null
  const action = body?.action
  if (action !== 'check' && action !== 'fix') {
    return NextResponse.json({ error: "action must be 'check' or 'fix'" }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data: script } = await supabase
    .from('scripts')
    .select('id, clinic_id, topic, hook, full_script, compliance')
    .eq('id', params.scriptId)
    .single()
  if (!script) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const { data: clinic } = await supabase
    .from('clinics')
    .select('niche')
    .eq('id', script.clinic_id ?? '')
    .single()
  const niche = clinic?.niche ?? null

  const stored = (script.compliance as unknown as ComplianceResult | null) ?? null
  const current = stored && gateRan(stored) ? stored : null
  const gateDown = () =>
    NextResponse.json(
      { error: 'The compliance check did not run. Try again in a minute.' },
      { status: 502 }
    )
  const save = async (patch: ScriptPatch, changed: boolean) => {
    const { data: updated, error } = await supabase
      .from('scripts')
      .update(patch)
      .eq('id', script.id)
      .select(RETURN_COLS)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, changed, script: updated })
  }

  if (action === 'check') {
    const graded = await runComplianceGate({
      script: gradedText(script.hook, script.full_script),
      topic: script.topic,
      niche,
    }).catch(() => null)
    if (!graded || !gateRan(graded)) return gateDown()
    return save({ compliance: graded as unknown as Json }, false)
  }

  if (current?.grade === 'PASS') {
    return NextResponse.json({ error: 'Nothing is flagged — no fix needed.' }, { status: 400 })
  }
  if (current?.grade === 'REMOVE') {
    return NextResponse.json(
      { error: 'This one needs a rewrite by hand — the claim itself is not allowed, so rewording cannot fix it.' },
      { status: 400 }
    )
  }

  // The rewriter works on the body. When the hook is the body's first
  // line (every hand-added script starts that way) the stored verdict
  // graded exactly this text and is reused; a separately typed hook is
  // graded in front of the body, so that verdict cannot seed the loop.
  const hookInBody = gradedText(script.hook, script.full_script) === script.full_script
  const converged = await convergeCompliance({
    script: script.full_script,
    topic: script.topic,
    niche,
    initial: hookInBody && current ? current : undefined,
  }).catch(() => null)
  if (!converged || !gateRan(converged.compliance)) return gateDown()

  const newBody = converged.script.trim()
  const changed = newBody !== script.full_script.trim()
  const newHook = changed && hookInBody ? (deriveHook(newBody) ?? script.hook) : script.hook

  let verdict: ComplianceResult | null = converged.compliance
  if (!hookInBody) {
    const graded = await runComplianceGate({
      script: gradedText(newHook, newBody),
      topic: script.topic,
      niche,
    }).catch(() => null)
    verdict = graded && gateRan(graded) ? graded : null
  }

  const patch: ScriptPatch = { compliance: verdict as unknown as Json }
  if (changed) {
    patch.full_script = newBody
    patch.hook = newHook
    patch.word_count = wordCount(newBody)
    patch.updated_at = new Date().toISOString()
  }
  return save(patch, changed)
}
