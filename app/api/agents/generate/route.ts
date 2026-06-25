import { waitUntil } from '@vercel/functions'
import { loadSharedContext, saveScripts } from '@/lib/supabase/context'
import { runWriter } from '@/lib/agents/writer'
import { runCritic } from '@/lib/agents/critic'
import { runComplianceGate } from '@/lib/posts/pipeline'
import { runComplianceRewriter } from '@/lib/agents/compliance-rewriter'
import { disabledHttpResponse, LLM_AGENTS_DISABLED_PAYLOAD, LLM_AGENTS_DISABLED_STATUS } from '@/lib/agents/disabled'
import { resolveAccess } from '@/lib/auth/session'
import type { CriticOutput, ComplianceResult, ScriptVariant } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 300

interface GeneratePostBody {
  clinicId: string
  topicHint?: string
}

export async function POST(req: Request) {
  const access = await resolveAccess()
  if (!access) return Response.json({ error: 'authentication required' }, { status: 401 })

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
  if (access.role !== 'admin' && ('clinicId' in access) && access.clinicId !== clinicId) {
    return Response.json({ error: 'access denied' }, { status: 403 })
  }

  const topicHint = body.topicHint?.trim() || undefined
  const encoder = new TextEncoder()

  let resolveWork!: () => void
  // waitUntil keeps the Vercel function alive even after the client disconnects
  waitUntil(new Promise<void>((res) => { resolveWork = res }))

  const stream = new ReadableStream({
    async start(controller) {
      const startMs = Date.now()

      function emit(event: string, data: unknown) {
        try {
          const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
          controller.enqueue(encoder.encode(chunk))
        } catch {
          // client disconnected — pipeline continues to saveScripts
        }
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

        const bestScore = Math.max(...scores.scores.map((s) => s.total_score))
        const needsRewrite = bestScore < 6.0
        if (needsRewrite) {
          stage('start')
          const feedback = buildFeedback(scores)
          variants = await runWriter({ context, feedback, topicHint })
          stage('writer:done')
          scores = await runCritic({ context, variants })
          stage('critic:done')
        }

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

        const fixedPairs = await Promise.all(
          variants.variants.map(async (v, i): Promise<{ variant: ScriptVariant; compliance: ComplianceResult } | null> => {
            const cr = complianceResults[i]
            if (!cr || cr.grade === 'REMOVE') return null
            if (cr.grade === 'PASS') return { variant: v, compliance: cr }

            const fixedScript = await runComplianceRewriter({ script: v.script, findings: cr.findings }).catch(() => null)
            if (!fixedScript) return { variant: v, compliance: cr }

            const recheck = await runComplianceGate({ script: fixedScript, topic: v.topic }).catch((): ComplianceResult => cr)
            if (recheck.grade === 'REMOVE') return null

            return { variant: { ...v, script: fixedScript }, compliance: recheck }
          })
        )
        const cleanPairs = fixedPairs.filter((p): p is NonNullable<typeof p> => p !== null)
        stage('compliance:done')

        const saved = await saveScripts(
          clinicId,
          cleanPairs.map(({ variant: v }) => {
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
          variants: cleanPairs.map((p) => p.variant),
          scores: scores.scores,
          compliance: cleanPairs.map((p) => ({ variant_id: p.variant.id, result: p.compliance })),
          saved,
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown error'
        emit('error', { error: msg })
      } finally {
        try { controller.close() } catch { /* already closed */ }
        resolveWork()
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
