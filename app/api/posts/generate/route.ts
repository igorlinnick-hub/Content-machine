import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { resolveAccess } from '@/lib/auth/session'
import {
  loadSharedContext,
  saveScripts,
  updateScriptCaptions,
  type ScoredVariant,
} from '@/lib/supabase/context'
import { runWriter } from '@/lib/agents/writer'
import { runCritic } from '@/lib/agents/critic'
import { runCaptioner } from '@/lib/agents/captioner'
import { disabledHttpResponse } from '@/lib/agents/disabled'
import { splitScriptToSlides } from '@/lib/visual/slides'
import { splitScriptToPostPlan } from '@/lib/posts/splitter'
import { renderSlides } from '@/lib/visual/renderer'
import { createSlideSet, loadStyleTemplate } from '@/lib/visual/store'
import { getPhotosFromFolder, getPhotoDataUrl } from '@/lib/google/drive'
import { getTopic, updateTopic } from '@/lib/posts/plan'
import { ensureDefaultCategories, matchCategory } from '@/lib/posts/categories'
import { ensureDefaultScriptTemplates } from '@/lib/posts/templates'
import {
  runComplianceGate,
  statusFromCompliance,
  checkServiceToken,
} from '@/lib/posts/pipeline'
import type {
  ScriptLengthTarget,
  SharedContext,
  VisualStyle,
  TypedSlide,
  ComplianceResult,
} from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 300

type LengthRequest = ScriptLengthTarget | 'both'

interface Body {
  clinicId?: string
  topicId?: string
  topic?: string
  photoFolderId?: string
  length?: LengthRequest
  note?: string
  template_variant?: 'classic' | 'wave'
  // HANDOFF-POSTS.md §22.5 — Canva-bot / cron path: pick a row from
  // content_plan_topics by plan_handle (e.g. "POST 18"). When set,
  // overrides topic/topicId.
  planId?: string
}

interface GenerateOneResult {
  length_target: ScriptLengthTarget
  script_id: string
  pair_id: string | null
  topic: string
  hook: string
  script: string
  word_count: number
  estimated_seconds: number
  template_name: string | null
  slides: TypedSlide[]
  previews: string[]
  slide_set_id: string | null
  short_caption: string | null
  long_caption: string | null
  category: { id: string; slug: string; name: string; emoji: string | null } | null
}

interface PhotoFolderRefs {
  folderId: string | null
  categoryId: string | null
  category: GenerateOneResult['category']
}

// Cross-call stage emitter. Used both as a console-log helper for the
// JSON path and as a stream-push hook for the SSE path. The route's
// stream handler installs a custom emitter that publishes each named
// stage to the client so the UI can show a real-time stepper.
type StageEmitter = (name: string, meta?: Record<string, unknown>) => void

async function generateOne(params: {
  clinicId: string
  context: SharedContext
  style: VisualStyle
  categories: Awaited<ReturnType<typeof ensureDefaultCategories>>
  topicText: string
  note?: string | null
  ctaHint: string | null
  length: ScriptLengthTarget
  pairId: string | null
  renderSlidesForThis: boolean
  preMatchedFolderId: string | null
  planId?: string | null
  onStage?: StageEmitter
}): Promise<GenerateOneResult> {
  // If the user pasted a starting note, fold it into the topic hint so the
  // writer treats it as additional steering, not a separate concept.
  const topicHintWithNote = params.note?.trim()
    ? `${params.topicText}\n\nDoctor's starting note (use as steer, do not quote verbatim):\n${params.note.trim()}`
    : params.topicText

  // Stage-by-stage timing log so a "Load failed" in the browser maps to a
  // specific stage in Vercel function logs. Logs go to stdout — surface in
  // the dashboard under the deployment's Logs tab.
  const t0 = Date.now()
  const stage = (name: string, meta?: Record<string, unknown>) => {
    console.log(`[generate] ${name} @ ${Date.now() - t0}ms`)
    params.onStage?.(name, { ...meta, elapsed_ms: Date.now() - t0 })
  }

  stage('start')
  const writerOut = await runWriter({
    context: params.context,
    topicHint: topicHintWithNote,
    ctaHint: params.ctaHint,
    variantCount: 3,
    lengthTarget: params.length,
    postCarouselMode: true,
  })
  stage('writer:done')
  const criticOut = await runCritic({
    context: params.context,
    variants: writerOut,
    lengthTarget: params.length,
  })
  stage('critic:done')

  const scoreById = new Map(criticOut.scores.map((s) => [s.variant_id, s]))
  const ranked = [...writerOut.variants].sort((a, b) => {
    const sa = scoreById.get(a.id)?.total_score ?? 0
    const sb = scoreById.get(b.id)?.total_score ?? 0
    return sb - sa
  })
  const winner = ranked[0]
  if (!winner) {
    throw new Error(`writer returned no variants for length=${params.length}`)
  }

  const variants: ScoredVariant[] = writerOut.variants.map((v) => {
    const s = scoreById.get(v.id)
    return {
      variant_id: v.id,
      topic: v.topic,
      hook: v.hook,
      script: v.script,
      word_count: v.word_count,
      critic_score: s?.total_score ?? 0,
      approved: s?.approved ?? false,
      length_target: params.length,
      pair_id: params.pairId,
      template_used: v.template_name ?? null,
    }
  })
  const saved = await saveScripts(params.clinicId, variants)
  const winnerSaved = saved.find((r) => r.variant_id === winner.id)
  if (!winnerSaved) {
    throw new Error('failed to save winner script')
  }

  // Caption — runs only on the winner. Cheap (Haiku) + small. Errors
  // here don't block the slide pipeline; we just leave captions null
  // and the operator can re-trigger from the bot if needed.
  let shortCaption: string | null = null
  let longCaption: string | null = null
  try {
    const captions = await runCaptioner({
      topic: winner.topic,
      hook: winner.hook,
      script: winner.script,
      clinic: params.context.clinic_profile,
    })
    shortCaption = captions.short_caption?.trim() || null
    longCaption = captions.long_caption?.trim() || null
    if (shortCaption && longCaption) {
      await updateScriptCaptions({
        scriptId: winnerSaved.id,
        shortCaption,
        longCaption,
      })
    }
  } catch {
    // Caption failure is recoverable — keep going.
  }

  const finalMatch = matchCategory(
    `${winner.topic} ${winner.script.slice(0, 400)}`,
    params.categories
  )
  const matchedCategory = finalMatch?.category ?? null
  const folderId =
    params.preMatchedFolderId || matchedCategory?.drive_folder_id || null

  stage('captioner:done')

  // Compliance gate runs on the winner BEFORE rendering. The verdict
  // is stored on the slide_sets row alongside the rendered preview;
  // status reflects the grade (ready_for_canva on PASS, blocked on
  // REMOVE/REWORD, needs_review on REVIEW).
  //
  // Hard 45s cap on the gate. If Opus is slow or rate-limited, we
  // fall back to factCheck-only verdict rather than blow the route's
  // 300s budget.
  let compliance: ComplianceResult | null = null
  try {
    compliance = await Promise.race([
      runComplianceGate({
        script: winner.script,
        category: matchedCategory?.name ?? null,
        topic: winner.topic,
      }),
      new Promise<ComplianceResult>((_, reject) =>
        setTimeout(() => reject(new Error('compliance LLM timeout 45s')), 45_000)
      ),
    ])
  } catch (e) {
    // Last-ditch: run the deterministic regex pass only — costs nothing,
    // produces a verdict (PASS or REWORD on hard fact violations).
    console.warn(
      `[generate] compliance fell back to factCheck-only: ${
        e instanceof Error ? e.message : 'unknown'
      }`
    )
    try {
      compliance = await runComplianceGate({
        script: winner.script,
        category: matchedCategory?.name ?? null,
        topic: winner.topic,
        skipLLM: true,
      })
    } catch {
      compliance = null
    }
  }
  stage('compliance:done')

  let slides: TypedSlide[] = []
  let previews: string[] = []
  let slideSetId: string | null = null

  // Helper: second UPDATE pass after createSlideSet, to persist the
  // compliance JSONB + plan_id. createSlideSet's legacy signature
  // doesn't take them; rather than touching the shared helper we patch
  // them here. Non-fatal — if it fails, the row still exists and the
  // grade still gated publish via the in-memory status we wrote above.
  async function patchComplianceAndPlan(targetSlideSetId: string) {
    if (!compliance && !params.planId) return
    try {
      const { createServerClient } = await import('@/lib/supabase/server')
      const supabase = createServerClient()
      const patch: Record<string, unknown> = {}
      if (compliance) {
        patch.compliance = JSON.parse(JSON.stringify(compliance))
      }
      if (params.planId) {
        patch.plan_id = params.planId
      }
      await supabase
        .from('slide_sets')
        .update(patch as never)
        .eq('id', targetSlideSetId)
    } catch {
      // swallow — see comment above
    }
  }

  if (params.renderSlidesForThis) {
    // POST CAROUSEL mode (the live path used by /visual Generate + the
    // cron + the Canva-bot service trigger): produce PostPlan-shaped
    // slides ({n, kind, heading, intro, bullets[], close}) and persist
    // them straight into slide_sets.slides JSONB. Canva-bot reads that
    // structured shape and assembles the carousel in Canva — Content
    // Machine does NOT render PNGs on this path. Skipping Puppeteer
    // saves ~5-10s/post and stops the navy-fallback preview confusion.
    //
    // Legacy fallback: if the PostPlan splitter fails (parse error /
    // model glitch), fall through to splitScriptToSlides → Puppeteer
    // render. That keeps the marketer UI working for ad-hoc topics that
    // don't yet have a structural-arc winner.

    let postPlanOk = false
    try {
      stage('splitter:postplan:start')
      const plan = await splitScriptToPostPlan(winner.script, {
        topic: winner.topic,
        hook: winner.hook,
      })
      stage('splitter:postplan:done')
      // Persist the rich PostPlan in slide_sets.slides. The legacy
      // TypedSlide path was a parseable prose stand-in; PostPlan is
      // the structured contract per HANDOFF-POSTS.md §15.
      const planRow = {
        cover: plan.cover,
        slides: plan.slides,
        cta: plan.cta,
        sources: plan.sources,
      }
      slides = []        // legacy TypedSlide list is intentionally empty
      previews = []      // Puppeteer skipped — Canva renders

      const lifecycleStatus = compliance
        ? statusFromCompliance(compliance)
        : 'needs_review'
      stage(
        `postplan:status=${lifecycleStatus} grade=${
          compliance?.grade ?? 'null'
        }`
      )

      const slideSetRow = await createSlideSet({
        clinicId: params.clinicId,
        scriptId: winnerSaved.id,
        slides: planRow as unknown as TypedSlide[], // JSONB stores anything
        styleTemplate: params.style,
        driveFolderId: folderId,
        categoryId: matchedCategory?.id ?? null,
        status: lifecycleStatus,
      })
      slideSetId = slideSetRow.id
      await patchComplianceAndPlan(slideSetRow.id)
      postPlanOk = true
      stage('postplan:persisted')
    } catch (e) {
      console.warn(
        `[generate] PostPlan splitter failed, falling back to legacy: ${
          e instanceof Error ? e.message : 'unknown'
        }`
      )
      postPlanOk = false
    }

    if (!postPlanOk) {
      stage('splitter:legacy:start')
      const split = await splitScriptToSlides(winner.script)
      slides = split.slides

      // Cover always renders without a photo (white bg + sky gradient).
      // Body and CTA can use photos. Drive returns webContentLink which
      // is not loadable by puppeteer without auth — we fetch bytes
      // server-side and pass as base64 data URLs.
      let photoUrls: (string | null)[] = slides.map(() => null)
      if (folderId && params.style.background.type === 'photo') {
        try {
          const photos = await getPhotosFromFolder(folderId)
          if (photos.length > 0) {
            const photoIds = slides.map((s, i) =>
              s.kind === 'cover' ? null : photos[i % photos.length]?.id ?? null
            )
            const fetched = await Promise.all(
              photoIds.map((id) =>
                id ? getPhotoDataUrl(id) : Promise.resolve(null)
              )
            )
            photoUrls = fetched
          }
        } catch {
          photoUrls = slides.map(() => null)
        }
      }

      const buffers = await renderSlides(
        slides.map((s, i) => ({ slide: s, photoUrl: photoUrls[i] })),
        params.style
      )
      previews = buffers.map(
        (b) => `data:image/png;base64,${b.toString('base64')}`
      )

      // Default to 'needs_review' (NOT 'rendered') when compliance is
      // null — 'rendered' was the legacy preview-PNG status that no
      // longer fits the script-factory model. If we don't have a
      // verdict, hold for human review.
      const lifecycleStatus = compliance
        ? statusFromCompliance(compliance)
        : 'needs_review'
      stage(
        `legacy:status=${lifecycleStatus} grade=${
          compliance?.grade ?? 'null'
        }`
      )

      const slideSetRow = await createSlideSet({
        clinicId: params.clinicId,
        scriptId: winnerSaved.id,
        slides,
        styleTemplate: params.style,
        driveFolderId: folderId,
        categoryId: matchedCategory?.id ?? null,
        status: lifecycleStatus,
      })
      slideSetId = slideSetRow.id
      await patchComplianceAndPlan(slideSetRow.id)
    }
  }

  return {
    length_target: params.length,
    script_id: winnerSaved.id,
    pair_id: params.pairId,
    topic: winner.topic,
    hook: winner.hook,
    script: winner.script,
    word_count: winner.word_count,
    estimated_seconds: winner.estimated_seconds,
    template_name: winner.template_name ?? null,
    slides,
    previews,
    slide_set_id: slideSetId,
    short_caption: shortCaption,
    long_caption: longCaption,
    category: matchedCategory
      ? {
          id: matchedCategory.id,
          slug: matchedCategory.slug,
          name: matchedCategory.name,
          emoji: matchedCategory.emoji,
        }
      : null,
  }
}

export async function POST(req: Request) {
  // Two auth paths (HANDOFF-POSTS.md §22.2):
  //   1. admin session — marketer in /visual UI
  //   2. SERVICE_TOKEN header — Canva-bot trigger / cron entry
  // The cron and Canva-bot paths both call this same route, just with
  // different auth headers, so the pipeline behaviour is identical.
  const isService = checkServiceToken(req)
  if (!isService) {
    const access = await resolveAccess()
    if (!access || access.role !== 'admin') {
      return NextResponse.json(
        { error: 'admin access required' },
        { status: 403 }
      )
    }
  }

  const off = await disabledHttpResponse()
  if (off) return off

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const clinicId = body.clinicId?.trim()
  const topicId = body.topicId?.trim()
  const freeTopic = body.topic?.trim()
  const planHandle = body.planId?.trim()
  if (!clinicId || (!topicId && !freeTopic && !planHandle)) {
    return NextResponse.json(
      { error: 'clinicId and one of topicId / topic / planId required' },
      { status: 400 }
    )
  }

  const lengthReq: LengthRequest =
    body.length === 'long' || body.length === 'both' || body.length === 'short'
      ? body.length
      : 'short'

  const url = new URL(req.url)
  const shouldStream = url.searchParams.get('stream') === '1'

  // The post-validation pipeline lives in this closure so both the JSON
  // and the SSE branches share one source of truth. When streaming, the
  // route handler installs a stage emitter that pushes events to the
  // client; in JSON mode the emitter is undefined and stages just log.
  const runPipeline = async (
    onStage: StageEmitter | undefined
  ): Promise<Record<string, unknown>> => {
    let topicText: string
    if (topicId) {
      const planTopic = await getTopic(topicId)
      if (!planTopic) {
        throw new Error('topic not found')
      }
      topicText = planTopic.topic
    } else if (planHandle) {
      // Canva-bot / cron path — resolve plan_handle to topic via
      // content_plan_topics. Service token already verified above.
      const { createServerClient } = await import('@/lib/supabase/server')
      const supabase = createServerClient()
      const { data: row } = await supabase
        .from('content_plan_topics')
        .select('topic')
        .eq('clinic_id', clinicId)
        .eq('plan_handle', planHandle)
        .maybeSingle()
      const t = (row as { topic?: string | null } | null)?.topic
      if (!t) {
        throw new Error(`plan_handle "${planHandle}" not found for clinic`)
      }
      topicText = t
    } else {
      topicText = freeTopic!
    }

    // Seed default templates first so loadSharedContext picks them up.
    await ensureDefaultScriptTemplates(clinicId)

    const [context, categories, baseStyle] = await Promise.all([
      loadSharedContext(clinicId),
      ensureDefaultCategories(clinicId),
      loadStyleTemplate(clinicId),
    ])

    // Apply per-request template variant override (default classic).
    // Lets the team pick the visual family at generate time without
    // mutating the clinic-wide style template.
    const style: VisualStyle =
      body.template_variant === 'wave' || body.template_variant === 'classic'
        ? { ...baseStyle, template_variant: body.template_variant }
        : baseStyle

    const preMatch = matchCategory(topicText, categories)
    const ctaHint =
      preMatch?.category.cta_template ??
      categories.find((c) => c.cta_template)?.cta_template ??
      null
    const photoFolderRefs: PhotoFolderRefs = {
      folderId:
        body.photoFolderId?.trim() ||
        preMatch?.category.drive_folder_id ||
        null,
      categoryId: preMatch?.category.id ?? null,
      category: preMatch
        ? {
            id: preMatch.category.id,
            slug: preMatch.category.slug,
            name: preMatch.category.name,
            emoji: preMatch.category.emoji,
          }
        : null,
    }

    const lengths: ScriptLengthTarget[] =
      lengthReq === 'both' ? ['short', 'long'] : [lengthReq]
    const pairId = lengths.length > 1 ? randomUUID() : null

    const noteText = body.note?.trim() ? body.note.trim() : null

    const results = await Promise.all(
      lengths.map((len) =>
        generateOne({
          clinicId,
          context,
          style,
          categories,
          topicText,
          note: noteText,
          ctaHint,
          length: len,
          pairId,
          // Render carousel for short (boost cut). Long is text-only;
          // user can request slides for it later via /api/visual/generate.
          renderSlidesForThis: len === 'short',
          preMatchedFolderId: photoFolderRefs.folderId,
          planId: body.planId ?? null,
          onStage,
        })
      )
    )

    // Mark plan topic done — link to the short script if present, otherwise long.
    if (topicId) {
      const linkScript =
        results.find((r) => r.length_target === 'short') ?? results[0]
      await updateTopic(topicId, {
        status: 'done',
        last_script_id: linkScript.script_id,
      })
    }

    const primary = results.find((r) => r.length_target === 'short') ?? results[0]

    return {
      // Backwards-compatible top-level shape (matches the previous response):
      slide_set_id: primary.slide_set_id,
      script_id: primary.script_id,
      topic: primary.topic,
      hook: primary.hook,
      script: primary.script,
      slides: primary.slides,
      previews: primary.previews,
      download_url: primary.slide_set_id
        ? `/api/visual/download?slideSetId=${primary.slide_set_id}`
        : null,
      category: primary.category ?? photoFolderRefs.category,
      pair_id: pairId,
      length_target: primary.length_target,
      versions: results,
    }
  } // end runPipeline

  if (shouldStream) {
    const encoder = new TextEncoder()
    const send = (
      controller: ReadableStreamDefaultController<Uint8Array>,
      event: string,
      payload: unknown
    ) => {
      const line = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`
      controller.enqueue(encoder.encode(line))
    }
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          send(controller, 'stage', { name: 'queued', elapsed_ms: 0 })
          const result = await runPipeline((name, meta) => {
            send(controller, 'stage', { name, ...(meta ?? {}) })
          })
          send(controller, 'done', result)
        } catch (e) {
          const err = e as {
            message?: unknown
            code?: string
            details?: string
            hint?: string
          }
          const msg =
            e instanceof Error
              ? e.message
              : e && typeof e === 'object' && 'message' in (e as object) && typeof err.message === 'string'
                ? err.message
                : String(e ?? 'unknown error')
          const supabaseDetails =
            err && typeof err === 'object'
              ? [err.code, err.details, err.hint].filter(Boolean).join(' | ')
              : ''
          console.error('[generate] stream catch:', msg, supabaseDetails, e)
          send(controller, 'error', {
            error: supabaseDetails ? `${msg} [${supabaseDetails}]` : msg,
          })
        } finally {
          controller.close()
        }
      },
    })
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        // Tell proxies (Vercel edge) not to buffer SSE.
        'X-Accel-Buffering': 'no',
      },
    })
  }

  try {
    const result = await runPipeline(undefined)
    return NextResponse.json(result)
  } catch (e) {
    // Surface every detail so "unknown error" / "[object Object]"
    // can't happen. The main trap: Supabase PostgrestError is a plain
    // object (not Error instance) — `String(e)` = "[object Object]".
    // 3-branch extraction: Error.message → object.message → String(e).
    const err = e as {
      message?: unknown
      status?: number
      code?: string
      details?: string
      hint?: string
      constructor?: { name: string }
    }
    const constructorName = err?.constructor?.name ?? 'Unknown'
    const status = typeof err?.status === 'number' ? err.status : null
    const msg =
      e instanceof Error
        ? e.message
        : e && typeof e === 'object' && 'message' in (e as object) && typeof err.message === 'string'
          ? err.message
          : String(e ?? 'unknown error')
    // Pull supabase-specific fields if present, so a column-missing /
    // RLS failure tells us exactly what to fix.
    const supabaseDetails =
      err && typeof err === 'object'
        ? [err.code, err.details, err.hint].filter(Boolean).join(' | ')
        : ''
    console.error(
      '[generate] route catch:',
      constructorName,
      'status:',
      status,
      'msg:',
      msg,
      'supabase:',
      supabaseDetails,
      e
    )
    return NextResponse.json(
      {
        error: supabaseDetails ? `${msg} [${supabaseDetails}]` : msg,
        kind: constructorName,
        status,
      },
      { status: 500 }
    )
  }
}
