import { NextResponse } from 'next/server'
import {
  loadSharedContext,
  saveScripts,
  saveScriptFeedback,
} from '@/lib/supabase/context'
import { runWriter } from '@/lib/agents/writer'
import { runCritic } from '@/lib/agents/critic'
import { createServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 300

interface RefinePostBody {
  clinicId: string
  scriptId: string
  note?: string
}

export async function POST(req: Request) {
  let body: RefinePostBody
  try {
    body = (await req.json()) as RefinePostBody
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const clinicId = body.clinicId?.trim()
  const scriptId = body.scriptId?.trim()
  if (!clinicId || !scriptId) {
    return NextResponse.json(
      { error: 'clinicId and scriptId are required' },
      { status: 400 }
    )
  }

  try {
    const supabase = createServerClient()
    const { data: original, error: loadErr } = await supabase
      .from('scripts')
      .select('id, clinic_id, variant_id, topic, hook, full_script')
      .eq('id', scriptId)
      .eq('clinic_id', clinicId)
      .maybeSingle()

    if (loadErr) throw loadErr
    if (!original) {
      return NextResponse.json(
        { error: 'original script not found for this clinic' },
        { status: 404 }
      )
    }

    const context = await loadSharedContext(clinicId)

    const note = body.note?.trim() || undefined

    let writerOut = await runWriter({
      context,
      topicHint: original.topic ?? undefined,
      variantCount: 1,
      refineFrom: {
        topic: original.topic ?? null,
        hook: original.hook ?? null,
        script: original.full_script ?? '',
        note,
      },
    })

    let criticOut = await runCritic({ context, variants: writerOut })

    // One automatic rewrite if the critic isn't happy — same loop as
    // /api/agents/generate.
    const needsRewrite = criticOut.scores.some((s) => !s.approved)
    if (needsRewrite) {
      const feedback = criticOut.scores
        .filter((s) => !s.approved)
        .map((s) => `[${s.variant_id} — score ${s.total_score}] ${s.feedback}`)
        .join('\n')
      writerOut = await runWriter({
        context,
        topicHint: original.topic ?? undefined,
        variantCount: 1,
        refineFrom: {
          topic: original.topic ?? null,
          hook: original.hook ?? null,
          script: original.full_script ?? '',
          note,
        },
        feedback,
      })
      criticOut = await runCritic({ context, variants: writerOut })
    }

    const newVariant = writerOut.variants[0]
    const newScore = criticOut.scores[0]
    if (!newVariant) {
      return NextResponse.json(
        { error: 'writer returned no variant' },
        { status: 500 }
      )
    }

    const saved = await saveScripts(clinicId, [
      {
        variant_id: newVariant.id,
        topic: newVariant.topic,
        hook: newVariant.hook,
        script: newVariant.script,
        word_count: newVariant.word_count,
        critic_score: newScore?.total_score ?? 0,
        approved: newScore?.approved ?? false,
      },
    ])

    // Record the original as "rejected" so the writer learns to avoid
    // that exact phrasing on future runs.
    await saveScriptFeedback({
      clinicId,
      entries: [{ scriptId: original.id, action: 'rejected' }],
    })

    return NextResponse.json({
      variant: newVariant,
      score: newScore ?? null,
      scriptId: saved[0]?.id ?? null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
