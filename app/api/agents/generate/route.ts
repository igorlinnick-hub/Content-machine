import { NextResponse } from 'next/server'
import { loadSharedContext, saveScripts } from '@/lib/supabase/context'
import { runWriter } from '@/lib/agents/writer'
import { runCritic } from '@/lib/agents/critic'
import type { CriticOutput } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 300

interface GeneratePostBody {
  clinicId: string
}

export async function POST(req: Request) {
  let body: GeneratePostBody
  try {
    body = (await req.json()) as GeneratePostBody
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const clinicId = body.clinicId?.trim()
  if (!clinicId) {
    return NextResponse.json({ error: 'clinicId is required' }, { status: 400 })
  }

  try {
    const context = await loadSharedContext(clinicId)

    let variants = await runWriter({ context })
    let scores = await runCritic({ context, variants })

    const needsRewrite = scores.scores.some((s) => !s.approved)
    if (needsRewrite) {
      const feedback = buildFeedback(scores)
      variants = await runWriter({ context, feedback })
      scores = await runCritic({ context, variants })
    }

    const scoreById = new Map(scores.scores.map((s) => [s.variant_id, s]))
    const saved = await saveScripts(
      clinicId,
      variants.variants.map((v) => {
        const s = scoreById.get(v.id)
        return {
          variant_id: v.id,
          topic: v.topic,
          hook: v.hook,
          script: v.script,
          word_count: v.word_count,
          critic_score: s?.total_score ?? 0,
          approved: s?.approved ?? false,
        }
      })
    )

    return NextResponse.json({
      clinic_id: clinicId,
      rewritten: needsRewrite,
      variants: variants.variants,
      scores: scores.scores,
      saved,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

function buildFeedback(scores: CriticOutput): string {
  return scores.scores
    .filter((s) => !s.approved)
    .map((s) => `[${s.variant_id} — score ${s.total_score}] ${s.feedback}`)
    .join('\n')
}

