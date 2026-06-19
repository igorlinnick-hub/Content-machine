import { loadSharedContext, saveScripts } from '@/lib/supabase/context'
import { runWriter } from '@/lib/agents/writer'
import { runCritic } from '@/lib/agents/critic'
import { runComplianceGate } from '@/lib/posts/pipeline'
import { disabledHttpResponse, LLM_AGENTS_DISABLED_PAYLOAD, LLM_AGENTS_DISABLED_STATUS } from '@/lib/agents/disabled'
import type { CriticOutput, ComplianceResult } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 300

interface GeneratePostBody {
  clinicId: string
  topicHint?: string
}

export async function POST(req: Request) {
  const off = await disabledHttpResponse()
  if (off) return off

  let body: GeneratePostBody
  try {
    body = (await req.json()) as GeneratePostBody
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const clinicId = body.clinicId?.trim()
  if (!clinicId) {
    return Response.json({ error: 'clinicId is required' }, { status: 400 })
  }

  const topicHint = body.topicHint?.trim() || undefined
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const startMs = Date.now()

      function emit(event: string, data: unknown) {
        const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
        controller.enqueue(encoder.encode(chunk))
      }

      function stage(name: string) {
        emit('stage', { name, elapsed_ms: Date.now() - startMs })
      }

      try {
        const context = await loadSharedContext(clinicId)

        stage('start')
        let variants = await runWriter({ context, topicHint })
        stage('writer:done')

        let scores = await runCritic({ context, variants })
        stage('critic:done')

        const needsRewrite = scores.scores.some((s) => !s.approved)
        if (needsRewrite) {
          stage('start')
          const feedback = buildFeedback(scores)
          variants = await runWriter({ context, feedback, topicHint })
          stage('writer:done')
          scores = await runCritic({ context, variants })
          stage('critic:done')
        }

        // compliance gate — runs on all variants in parallel
        stage('captioner:done')
        const complianceResults = await Promise.all(
          variants.variants.map((v) =>
            runComplianceGate({ script: v.script, topic: v.topic }).catch(
              (): ComplianceResult => ({
                grade: 'REVIEW',
                findings: [],
                model: 'fallback',
                ruleset_version: 'v2.1',
                run_at: new Date().toISOString(),
              })
            )
          )
        )
        stage('compliance:done')

        const saved = await saveScripts(
          clinicId,
          variants.variants.map((v) => {
            const s = scores.scores.find((sc) => sc.variant_id === v.id)
            return {
              variant_id: v.id,
              topic: v.topic,
              hook: v.hook,
              script: v.script,
              word_count: v.word_count,
              critic_score: s?.total_score ?? 0,
              approved: s?.approved ?? false,
              template_used: v.template_name ?? null,
            }
          })
        )

        emit('done', {
          clinic_id: clinicId,
          rewritten: needsRewrite,
          variants: variants.variants,
          scores: scores.scores,
          compliance: variants.variants.map((v, i) => ({
            variant_id: v.id,
            result: complianceResults[i] ?? null,
          })),
          saved,
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown error'
        emit('error', { error: msg })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

function buildFeedback(scores: CriticOutput): string {
  return scores.scores
    .filter((s) => !s.approved)
    .map((s) => `[${s.variant_id} — score ${s.total_score}] ${s.feedback}`)
    .join('\n')
}
