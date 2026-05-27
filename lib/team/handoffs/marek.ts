import { randomUUID } from 'crypto'
import { runWriter } from '@/lib/agents/writer'
import { runCritic } from '@/lib/agents/critic'
import { runCaptioner } from '@/lib/agents/captioner'
import { guardDisabledHandoff } from '@/lib/agents/disabled'
import { splitScriptToSlides } from '@/lib/visual/slides'
import { renderSlides } from '@/lib/visual/renderer'
import { createSlideSet, loadStyleTemplate } from '@/lib/visual/store'
import { getPhotosFromFolder, getPhotoDataUrl } from '@/lib/google/drive'
import {
  loadSharedContext,
  saveScripts,
  updateScriptCaptions,
  type ScoredVariant,
} from '@/lib/supabase/context'
import { ensureDefaultCategories, matchCategory } from '@/lib/posts/categories'
import { ensureDefaultScriptTemplates } from '@/lib/posts/templates'
import { createServerClient } from '@/lib/supabase/server'
import type { ScriptLengthTarget, TypedSlide } from '@/types'
import { tgChatAction, tgSend, tgSendMediaGroup } from '../telegram'

// Marek's real-handoff: invokes the same writer / critic / splitter /
// renderer pipeline as /api/posts/generate, without the HTTP hop. We
// skip the route handler so the Telegram bot doesn't have to forge
// admin cookies — it's already gated by webhook secret.

export interface MarekGeneratePostParams {
  topic: string
  length?: ScriptLengthTarget
  note?: string
}

export interface MarekHandoffContext {
  clinicId: string
  chatId: number | string
  agentEmoji: string
  agentName: string
}

export async function runMarekGeneratePost(
  params: MarekGeneratePostParams,
  ctx: MarekHandoffContext
): Promise<void> {
  if (await guardDisabledHandoff(ctx, 'Post generation')) return
  const length: ScriptLengthTarget = params.length ?? 'short'
  const topic = params.topic.trim()
  if (!topic) {
    await tgSend(
      ctx.chatId,
      `${ctx.agentEmoji} *${ctx.agentName}*\n\nI need a topic to draft a post. Give me one sentence and I'll start.`
    )
    return
  }

  await tgChatAction(ctx.chatId, 'upload_photo')

  try {
    await ensureDefaultScriptTemplates(ctx.clinicId)
    const [context, categories, style] = await Promise.all([
      loadSharedContext(ctx.clinicId),
      ensureDefaultCategories(ctx.clinicId),
      loadStyleTemplate(ctx.clinicId),
    ])

    const preMatch = matchCategory(topic, categories)
    const ctaHint =
      preMatch?.category.cta_template ??
      categories.find((c) => c.cta_template)?.cta_template ??
      null
    const folderId = preMatch?.category.drive_folder_id ?? null
    const matchedCategory = preMatch?.category ?? null

    const topicHint = params.note?.trim()
      ? `${topic}\n\nDoctor's starting note (use as steer, do not quote verbatim):\n${params.note.trim()}`
      : topic

    const writerOut = await runWriter({
      context,
      topicHint,
      ctaHint,
      variantCount: 3,
      lengthTarget: length,
    })
    const criticOut = await runCritic({
      context,
      variants: writerOut,
      lengthTarget: length,
    })

    const scoreById = new Map(criticOut.scores.map((s) => [s.variant_id, s]))
    const ranked = [...writerOut.variants].sort((a, b) => {
      const sa = scoreById.get(a.id)?.total_score ?? 0
      const sb = scoreById.get(b.id)?.total_score ?? 0
      return sb - sa
    })
    const winner = ranked[0]
    if (!winner) throw new Error('writer returned no variants')

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
        length_target: length,
        pair_id: null,
        template_used: v.template_name ?? null,
      }
    })
    const saved = await saveScripts(ctx.clinicId, variants)
    const winnerSaved = saved.find((r) => r.variant_id === winner.id)
    if (!winnerSaved) throw new Error('failed to save winner script')

    // Captions — same pattern as /api/posts/generate. Errors are
    // tolerated; bot path can re-trigger captioning later if needed.
    let shortCaption: string | null = null
    let longCaption: string | null = null
    try {
      const captions = await runCaptioner({
        topic: winner.topic,
        hook: winner.hook,
        script: winner.script,
        clinic: context.clinic_profile,
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
      // Recoverable.
    }

    let slides: TypedSlide[] = []
    let buffers: Buffer[] = []
    let slideSetId: string | null = null

    if (length === 'short') {
      const split = await splitScriptToSlides(winner.script)
      slides = split.slides

      let photoUrls: (string | null)[] = slides.map(() => null)
      if (folderId && style.background.type === 'photo') {
        try {
          const photos = await getPhotosFromFolder(folderId)
          if (photos.length > 0) {
            const photoIds = slides.map((s, i) =>
              s.kind === 'cover' ? null : photos[i % photos.length]?.id ?? null
            )
            photoUrls = await Promise.all(
              photoIds.map((id) =>
                id ? getPhotoDataUrl(id) : Promise.resolve(null)
              )
            )
          }
        } catch {
          // Drive flake — fall back to no photos.
          photoUrls = slides.map(() => null)
        }
      }

      buffers = await renderSlides(
        slides.map((s, i) => ({ slide: s, photoUrl: photoUrls[i] })),
        style
      )

      const slideSet = await createSlideSet({
        clinicId: ctx.clinicId,
        scriptId: winnerSaved.id,
        slides,
        styleTemplate: style,
        driveFolderId: folderId,
        categoryId: matchedCategory?.id ?? null,
        status: 'rendered',
      })
      slideSetId = slideSet.id
    }

    const reviewBase = process.env.NEXT_PUBLIC_APP_URL ?? ''
    const reviewLink = slideSetId
      ? `${reviewBase}/posts/${slideSetId}`
      : null

    const captionLines = [
      `${ctx.agentEmoji} *${ctx.agentName}* drafted:`,
      ``,
      `*${winner.topic}*`,
      ``,
      `_${winner.hook}_`,
    ]
    if (shortCaption) {
      captionLines.push('', '*Short caption*', shortCaption)
    }
    if (reviewLink) {
      captionLines.push('', `Review & approve: ${reviewLink}`)
    }
    const caption = captionLines.join('\n')

    if (buffers.length > 0) {
      const album = await tgSendMediaGroup(ctx.chatId, buffers, caption)
      if (!album.ok) {
        // Album rejected — fall back to single-cover send so the
        // operator at least sees something.
        await tgSend(
          ctx.chatId,
          caption +
            `\n\n_(media group failed status=${album.status}, slides saved at the review link above)_`
        )
      }
    } else {
      // Long-form path: no carousel, just text.
      await tgSend(ctx.chatId, caption)
    }

    // Suppress unused warning while we keep the random id helper
    // around for future pair-generation features.
    void randomUUID
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    await tgSend(
      ctx.chatId,
      `${ctx.agentEmoji} *${ctx.agentName}*\n\n_(generate failed: ${msg})_`
    )
  }
}

// Marek refine_post: take an existing slide_set, refine the script
// per the operator's note (writer.refineFrom mode), critic + render
// + new slide_set + post album. Old slide_set stays — operator can
// compare.

export interface MarekRefinePostParams {
  slide_set_id?: string
  note: string
  length?: ScriptLengthTarget
}

interface SlideSetWithScript {
  id: string
  script_id: string | null
  drive_folder_id: string | null
  category_id: string | null
  scripts:
    | {
        topic: string | null
        hook: string | null
        full_script: string
        length_target: string | null
      }
    | Array<{
        topic: string | null
        hook: string | null
        full_script: string
        length_target: string | null
      }>
    | null
}

export async function runMarekRefinePost(
  params: MarekRefinePostParams,
  ctx: MarekHandoffContext
): Promise<void> {
  if (await guardDisabledHandoff(ctx, 'Post refinement')) return
  const note = params.note.trim()
  if (!note) {
    await tgSend(
      ctx.chatId,
      `${ctx.agentEmoji} *${ctx.agentName}*\n\nGive me a refine note — what's wrong with the post and how should I fix it.`
    )
    return
  }

  const supabase = createServerClient()
  const baseQuery = supabase
    .from('slide_sets')
    .select(
      'id, script_id, drive_folder_id, category_id, scripts ( topic, hook, full_script, length_target )'
    )
    .eq('clinic_id', ctx.clinicId)
  const target = params.slide_set_id
    ? await baseQuery.eq('id', params.slide_set_id).maybeSingle()
    : await baseQuery
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
  if (!target.data) {
    await tgSend(
      ctx.chatId,
      `${ctx.agentEmoji} *${ctx.agentName}*\n\nNo slide_set to refine.`
    )
    return
  }
  const row = target.data as unknown as SlideSetWithScript
  const s = Array.isArray(row.scripts) ? row.scripts[0] : row.scripts
  if (!s || !s.full_script) {
    await tgSend(
      ctx.chatId,
      `${ctx.agentEmoji} *${ctx.agentName}*\n\nslide_set ${row.id.slice(0, 8)} has no script linked — cannot refine.`
    )
    return
  }

  const length: ScriptLengthTarget =
    (s.length_target as ScriptLengthTarget | null) ?? params.length ?? 'short'

  await tgChatAction(ctx.chatId, 'upload_photo')

  try {
    await ensureDefaultScriptTemplates(ctx.clinicId)
    const [context, , style] = await Promise.all([
      loadSharedContext(ctx.clinicId),
      ensureDefaultCategories(ctx.clinicId),
      loadStyleTemplate(ctx.clinicId),
    ])

    const writerOut = await runWriter({
      context,
      lengthTarget: length,
      variantCount: 1,
      refineFrom: {
        topic: s.topic,
        hook: s.hook,
        script: s.full_script,
        note,
      },
    })
    const criticOut = await runCritic({
      context,
      variants: writerOut,
      lengthTarget: length,
    })
    const winner = writerOut.variants[0]
    if (!winner) throw new Error('refine produced no variant')
    const score = criticOut.scores[0]

    const variants: ScoredVariant[] = [
      {
        variant_id: winner.id,
        topic: winner.topic,
        hook: winner.hook,
        script: winner.script,
        word_count: winner.word_count,
        critic_score: score?.total_score ?? 0,
        approved: score?.approved ?? false,
        length_target: length,
        pair_id: null,
        template_used: winner.template_name ?? null,
      },
    ]
    const saved = await saveScripts(ctx.clinicId, variants)
    const winnerSaved = saved[0]
    if (!winnerSaved) throw new Error('failed to save refined script')

    let shortCaption: string | null = null
    let longCaption: string | null = null
    try {
      const captions = await runCaptioner({
        topic: winner.topic,
        hook: winner.hook,
        script: winner.script,
        clinic: context.clinic_profile,
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
      // recoverable
    }

    let buffers: Buffer[] = []
    let slideSetId: string | null = null
    if (length === 'short') {
      const split = await splitScriptToSlides(winner.script)
      const slides = split.slides
      const folderId = row.drive_folder_id
      let photoUrls: (string | null)[] = slides.map(() => null)
      if (folderId && style.background.type === 'photo') {
        try {
          const photos = await getPhotosFromFolder(folderId)
          if (photos.length > 0) {
            const photoIds = slides.map((sl, i) =>
              sl.kind === 'cover' ? null : photos[i % photos.length]?.id ?? null
            )
            photoUrls = await Promise.all(
              photoIds.map((id) =>
                id ? getPhotoDataUrl(id) : Promise.resolve(null)
              )
            )
          }
        } catch {
          photoUrls = slides.map(() => null)
        }
      }
      buffers = await renderSlides(
        slides.map((sl, i) => ({ slide: sl, photoUrl: photoUrls[i] })),
        style
      )
      const newSlideSet = await createSlideSet({
        clinicId: ctx.clinicId,
        scriptId: winnerSaved.id,
        slides,
        styleTemplate: style,
        driveFolderId: folderId ?? null,
        categoryId: row.category_id ?? null,
        status: 'rendered',
      })
      slideSetId = newSlideSet.id
    }

    const reviewBase = process.env.NEXT_PUBLIC_APP_URL ?? ''
    const reviewLink = slideSetId ? `${reviewBase}/posts/${slideSetId}` : null

    const captionLines = [
      `${ctx.agentEmoji} *${ctx.agentName}* refined (was ${row.id.slice(0, 8)}):`,
      ``,
      `*${winner.topic}*`,
      ``,
      `_${winner.hook}_`,
    ]
    if (shortCaption) captionLines.push('', '*Short caption*', shortCaption)
    if (score) {
      captionLines.push('', `Critic: ${score.total_score.toFixed(1)} ${score.approved ? '🟢' : '🔴'}`)
    }
    if (reviewLink) captionLines.push('', `Review: ${reviewLink}`)
    const caption = captionLines.join('\n')

    if (buffers.length > 0) {
      const album = await tgSendMediaGroup(ctx.chatId, buffers, caption)
      if (!album.ok) {
        await tgSend(ctx.chatId, caption)
      }
    } else {
      await tgSend(ctx.chatId, caption)
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    await tgSend(
      ctx.chatId,
      `${ctx.agentEmoji} *${ctx.agentName}*\n\n_(refine failed: ${msg})_`
    )
  }
}
