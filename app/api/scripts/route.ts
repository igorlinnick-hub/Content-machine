import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { resolveAccess } from '@/lib/auth/session'
import { saveManualScript } from '@/lib/supabase/context'
import { runComplianceGate } from '@/lib/posts/pipeline'
import { MANUAL_SCRIPT_MAX_CHARS, gateRan } from '@/lib/scripts/manual'
import { nicheIsScreened } from '@/lib/niche/profiles'

export const runtime = 'nodejs'
// One gate pass: factCheck + one Opus grade, ~5-20 s.
export const maxDuration = 60

interface PostBody {
  clinicId?: string
  topic?: string
  full_script?: string
}

/**
 * "+ Add your own script" — save a script a person wrote by hand.
 *
 * It never went through Writer or Critic, so the compliance gate runs
 * BEFORE the row exists: a script with no verdict never reaches the list.
 * If the gate itself fails, nothing is saved and the text stays in the
 * form for a retry. The verdict is stored, not acted on — a flagged
 * script is saved so it can be fixed, and the star (what puts it on the
 * doctor's list) stays locked until it is.
 *
 * Admin only, like Generate: the marketing team writes, the doctor
 * records the starred ones.
 *
 * An unscreened niche (HireDrop — see nicheIsScreened) saves straight
 * away with no verdict: it is not clinic copy.
 */
export async function POST(req: Request) {
  const access = await resolveAccess()
  if (!access) return NextResponse.json({ error: 'auth required' }, { status: 401 })
  if (access.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = (await req.json().catch(() => null)) as PostBody | null
  if (!body) return NextResponse.json({ error: 'invalid body' }, { status: 400 })

  const clinicId = body.clinicId?.trim()
  const topic = body.topic?.trim() ?? ''
  const fullScript = body.full_script?.trim() ?? ''
  if (!clinicId) return NextResponse.json({ error: 'clinicId required' }, { status: 400 })
  if (!topic) return NextResponse.json({ error: 'Give the script a title' }, { status: 400 })
  if (topic.length > 200) {
    return NextResponse.json({ error: 'Title is too long (200 characters max)' }, { status: 400 })
  }
  if (!fullScript) return NextResponse.json({ error: 'Script text is empty' }, { status: 400 })
  if (fullScript.length > MANUAL_SCRIPT_MAX_CHARS) {
    return NextResponse.json(
      { error: `Script is too long (${MANUAL_SCRIPT_MAX_CHARS.toLocaleString('en-US')} characters max)` },
      { status: 400 }
    )
  }

  const supabase = createServerClient()
  const { data: clinic } = await supabase
    .from('clinics')
    .select('id, niche')
    .eq('id', clinicId)
    .single()
  if (!clinic) return NextResponse.json({ error: 'clinic not found' }, { status: 404 })

  if (!nicheIsScreened(clinic.niche)) {
    try {
      const script = await saveManualScript({ clinicId, topic, fullScript, compliance: null })
      return NextResponse.json({ ok: true, script })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'save failed'
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

  const compliance = await runComplianceGate({
    script: fullScript,
    topic,
    niche: clinic.niche,
  }).catch((e) => {
    console.error('add-script: compliance gate failed', e)
    return null
  })
  if (!compliance || !gateRan(compliance)) {
    return NextResponse.json(
      { error: 'The compliance check did not run — nothing was saved. Try again.' },
      { status: 502 }
    )
  }

  try {
    const script = await saveManualScript({ clinicId, topic, fullScript, compliance })
    return NextResponse.json({ ok: true, script })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'save failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
