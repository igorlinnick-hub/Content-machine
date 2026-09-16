import { waitUntil } from '@vercel/functions'
import { loadSharedContext, saveScripts, pruneOldScripts } from '@/lib/supabase/context'
import { runWriter } from '@/lib/agents/writer'
import { runCritic } from '@/lib/agents/critic'
import { runComplianceGate } from '@/lib/posts/pipeline'
import { convergeCompliance } from '@/lib/agents/compliance-loop'
import { disabledHttpResponse } from '@/lib/agents/disabled'
import { resolveAccess } from '@/lib/auth/session'
import { getCurrentPlanContext } from '@/lib/content-plan/store'
import { isKnownAdFormat } from '@/lib/scripts/ad-formats'
import { isKnownFormat } from '@/lib/posts/formats'
import { loadObjection, nextUnansweredObjection } from '@/lib/objections/store'
import type { CriticOutput, ComplianceResult, ScriptVariant, ScriptLengthTarget } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 300

interface GeneratePostBody {
  clinicId: string
  topicHint?: string
  // Planned mode (90% path): pass the content_plan_topics.id so the
  // Writer receives the full pillar/theme/keyword context.
  planTopicId?: string
  // Ad mode (Igor 2026-08-20): one of AD_FORMATS by name. Switches the whole
  // run to the paid-spot shape — ad beats, 'ad' length target, ad rubric in
  // the Critic. Ignored (and the run stays organic) if the name is unknown.
  adFormat?: string
  // Organic format for THIS run — one of POST_FORMATS by name (Igor
  // 2026-09-10). Until now the shape of a teleprompter script could only be
  // set upstream, on the plan topic, so a format added to the catalog never
  // showed up as a choice on the Generate screen. Same field and same
  // semantics as /api/posts/generate: it outranks the planned format.
  format?: string
  // One question from clinic_objections (056) — the subject of a
  // `Patient question` script. 'next' takes the clinic's first unanswered
  // question instead, which is what turns a shooting day into twenty
  // answers in a row. Pinning a question also pins the format.
  objectionId?: string
}

export async function POST(req: Request) {
  const access = await resolveAccess()
  if (!access) return Response.json({ error: 'authentication required' }, { status: 401 })
  // Writing scripts is ours, not the clinic's (Igor 2026-09-10): we
  // generate, we star what we want filmed, the doctor records it. The
  // /scripts UI hides the Generate tab from doctors — this is the gate
  // that makes it true for anyone hitting the endpoint directly.
  if (access.role !== 'admin') {
    return Response.json(
      { error: 'script generation is admin-only' },
      { status: 403 }
    )
  }

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
  // No per-clinic check below: the admin gate above already means the
  // caller may act on any clinic.

  const topicHint = body.topicHint?.trim() || undefined
  const planTopicId = body.planTopicId?.trim() || undefined
  // Resolve against the registry rather than trusting the client string —
  // an unknown name must degrade to a normal organic run, not reach the
  // Writer as a bogus format block.
  const adFormat = isKnownAdFormat(body.adFormat) ? body.adFormat!.trim() : undefined
  const lengthTarget: ScriptLengthTarget | undefined = adFormat ? 'ad' : undefined
  // Same guard for the organic format: an unknown name falls back to the
  // planned format rather than reaching the Writer as a bogus block. An ad
  // run ignores it — the ad format already owns the shape of that script.
  const formatOverride =
    !adFormat && isKnownFormat(body.format) ? body.format!.trim() : null

  // The question, if this run answers one. 'next' walks the clinic's map to
  // the first question no script has answered yet — the shooting-day path.
  // A pinned question implies the format: answering one is what
  // `Patient question` IS, and letting the plan's format win here would
  // produce an explainer wrapped around someone's literal words.
  const objectionRef = body.objectionId?.trim()
  const objection = objectionRef
    ? await (objectionRef === 'next'
        ? nextUnansweredObjection(clinicId)
        : loadObjection(objectionRef, clinicId)
      ).catch(() => null)
    : null
  const pinnedQuestion = objection?.question ?? null
  const effectiveFormat =
    !adFormat && pinnedQuestion ? 'Patient question' : formatOverride

  // Resolve plan context: either from a specific plan topic or null (ad-hoc).
  // A pinned question replaces the plan's topic — the question IS the topic.
  const planContext = planTopicId && !pinnedQuestion
    ? await getCurrentPlanContext(clinicId, planTopicId).catch(() => null)
    : null

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
        let variants = await runWriter({ context, topicHint, planContext, adFormat, lengthTarget, formatOverride: effectiveFormat, pinnedQuestion })
        stage('writer:done')

        let scores = await runCritic({ context, variants, lengthTarget })
        stage('critic:done')

        const bestScore = Math.max(...scores.scores.map((s) => s.total_score))
        const needsRewrite = bestScore < 6.0
        if (needsRewrite) {
          stage('start')
          const feedback = buildFeedback(scores)
          variants = await runWriter({ context, feedback, topicHint, planContext, adFormat, lengthTarget, formatOverride: effectiveFormat, pinnedQuestion })
          stage('writer:done')
          scores = await runCritic({ context, variants, lengthTarget })
          stage('critic:done')
        }

        stage('captioner:done')
        const clinicNiche = context.clinic_profile.niche
        const complianceResults = await Promise.all(
          variants.variants.map((v) =>
            runComplianceGate({ script: v.script, topic: v.topic, niche: clinicNiche }).catch(
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

            // Full cycle: rewrite → regrade until clean (max 3 rounds) —
            // the doctor gets a finished script, not a findings to-do list.
            const converged = await convergeCompliance({
              script: v.script,
              topic: v.topic,
              niche: clinicNiche,
              initial: cr,
            }).catch(() => null)
            if (!converged) return { variant: v, compliance: cr }
            if (converged.compliance.grade === 'REMOVE') return null

            return { variant: { ...v, script: converged.script }, compliance: converged.compliance }
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
              // Ads carry their band so the library can tell a 30-second
              // spot from a 90-second organic script; organic runs keep
              // leaving this null, exactly as before.
              length_target: lengthTarget ?? null,
              template_used: v.template_name ?? null,
              // The library index: which question this script answers.
              objection_id: objection?.id ?? null,
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

        // The teleprompter list IS the archive: keep the newest 30
        // scripts, hard-delete the rest (posts stay protected).
        await pruneOldScripts(clinicId, 30).catch(() => 0)
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
