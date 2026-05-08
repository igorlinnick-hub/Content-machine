import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { resolveAccess } from '@/lib/auth/session'
import {
  loadSharedContext,
  saveScripts,
  type ScoredVariant,
} from '@/lib/supabase/context'
import { runWriter } from '@/lib/agents/writer'
import { runCritic } from '@/lib/agents/critic'
import { splitScriptToSlides } from '@/lib/visual/slides'
import { renderSlides } from '@/lib/visual/renderer'
import { createSlideSet, loadStyleTemplate } from '@/lib/visual/store'
import { getPhotosFromFolder } from '@/lib/google/drive'
import { getTopic, updateTopic } from '@/lib/posts/plan'
import { ensureDefaultCategories, matchCategory } from '@/lib/posts/categories'
import { ensureDefaultScriptTemplates } from '@/lib/posts/templates'
import type { ScriptLengthTarget, SharedContext, VisualStyle } from '@/types'

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
  slides: string[]
  previews: string[]
  slide_set_id: string | null
  category: { id: string; slug: string; name: string; emoji: string | null } | null
}

interface PhotoFolderRefs {
  folderId: string | null
  categoryId: string | null
  category: GenerateOneResult['category']
}

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
}): Promise<GenerateOneResult> {
  // If the user pasted a starting note, fold it into the topic hint so the
  // writer treats it as additional steering, not a separate concept.
  const topicHintWithNote = params.note?.trim()
    ? `${params.topicText}\n\nDoctor's starting note (use as steer, do not quote verbatim):\n${params.note.trim()}`
    : params.topicText

  const writerOut = await runWriter({
    context: params.context,
    topicHint: topicHintWithNote,
    ctaHint: params.ctaHint,
    variantCount: 3,
    lengthTarget: params.length,
  })
  const criticOut = await runCritic({
    context: params.context,
    variants: writerOut,
    lengthTarget: params.length,
  })

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
    }
  })
  const saved = await saveScripts(params.clinicId, variants)
  const winnerSaved = saved.find((r) => r.variant_id === winner.id)
  if (!winnerSaved) {
    throw new Error('failed to save winner script')
  }

  const finalMatch = matchCategory(
    `${winner.topic} ${winner.script.slice(0, 400)}`,
    params.categories
  )
  const matchedCategory = finalMatch?.category ?? null
  const folderId =
    params.preMatchedFolderId || matchedCategory?.drive_folder_id || null

  let slides: string[] = []
  let previews: string[] = []
  let slideSetId: string | null = null

  if (params.renderSlidesForThis) {
    const split = await splitScriptToSlides(winner.script)
    slides = split.slides

    let photoUrls: (string | null)[] = slides.map(() => null)
    if (folderId && params.style.background.type === 'photo') {
      try {
        const photos = await getPhotosFromFolder(folderId)
        if (photos.length > 0) {
          photoUrls = slides.map(
            (_, i) => photos[i % photos.length]?.webContentLink ?? null
          )
        }
      } catch {
        photoUrls = slides.map(() => null)
      }
    }

    const buffers = await renderSlides(
      slides.map((text, i) => ({ text, photoUrl: photoUrls[i] })),
      params.style
    )
    previews = buffers.map((b) => `data:image/png;base64,${b.toString('base64')}`)

    const slideSet = await createSlideSet({
      clinicId: params.clinicId,
      scriptId: winnerSaved.id,
      slides,
      styleTemplate: params.style,
      driveFolderId: folderId,
      categoryId: matchedCategory?.id ?? null,
      status: 'rendered',
    })
    slideSetId = slideSet.id
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
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const clinicId = body.clinicId?.trim()
  const topicId = body.topicId?.trim()
  const freeTopic = body.topic?.trim()
  if (!clinicId || (!topicId && !freeTopic)) {
    return NextResponse.json(
      { error: 'clinicId and either topicId or topic required' },
      { status: 400 }
    )
  }

  const lengthReq: LengthRequest =
    body.length === 'long' || body.length === 'both' || body.length === 'short'
      ? body.length
      : 'short'

  try {
    let topicText: string
    if (topicId) {
      const planTopic = await getTopic(topicId)
      if (!planTopic) {
        return NextResponse.json({ error: 'topic not found' }, { status: 404 })
      }
      topicText = planTopic.topic
    } else {
      topicText = freeTopic!
    }

    // Seed default templates first so loadSharedContext picks them up.
    await ensureDefaultScriptTemplates(clinicId)

    const [context, categories, style] = await Promise.all([
      loadSharedContext(clinicId),
      ensureDefaultCategories(clinicId),
      loadStyleTemplate(clinicId),
    ])

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

    return NextResponse.json({
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
      // New fields:
      pair_id: pairId,
      length_target: primary.length_target,
      versions: results,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
