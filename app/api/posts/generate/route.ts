import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import {
  loadSharedContext,
  saveScripts,
} from '@/lib/supabase/context'
import { runWriter } from '@/lib/agents/writer'
import { runCritic } from '@/lib/agents/critic'
import { splitScriptToSlides } from '@/lib/visual/slides'
import { renderSlides } from '@/lib/visual/renderer'
import { createSlideSet, loadStyleTemplate } from '@/lib/visual/store'
import { getPhotosFromFolder } from '@/lib/google/drive'
import { getTopic, updateTopic } from '@/lib/posts/plan'
import { ensureDefaultCategories, matchCategory } from '@/lib/posts/categories'

export const runtime = 'nodejs'
export const maxDuration = 300

interface Body {
  clinicId?: string
  topicId?: string
  photoFolderId?: string
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
  if (!clinicId || !topicId) {
    return NextResponse.json(
      { error: 'clinicId and topicId required' },
      { status: 400 }
    )
  }

  try {
    const planTopic = await getTopic(topicId)
    if (!planTopic) {
      return NextResponse.json({ error: 'topic not found' }, { status: 404 })
    }

    const context = await loadSharedContext(clinicId)
    const categories = await ensureDefaultCategories(clinicId)

    // Match category up-front from the plan topic alone so we can
    // feed the right CTA template into the writer.
    const preMatch = matchCategory(planTopic.topic, categories)
    const ctaHint =
      preMatch?.category.cta_template ??
      categories.find((c) => c.cta_template)?.cta_template ??
      null

    // 3 variants on the same topic, then critic picks the best.
    const writerOut = await runWriter({
      context,
      topicHint: planTopic.topic,
      ctaHint,
      variantCount: 3,
    })
    const criticOut = await runCritic({ context, variants: writerOut })

    const scoreById = new Map(
      criticOut.scores.map((s) => [s.variant_id, s])
    )
    const ranked = [...writerOut.variants].sort((a, b) => {
      const sa = scoreById.get(a.id)?.total_score ?? 0
      const sb = scoreById.get(b.id)?.total_score ?? 0
      return sb - sa
    })
    const winner = ranked[0]
    if (!winner) {
      return NextResponse.json({ error: 'writer returned no variants' }, { status: 502 })
    }

    // Save all variants to scripts table (so feedback / few-shot can reference them later).
    const saved = await saveScripts(
      clinicId,
      writerOut.variants.map((v) => {
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
    const winnerSaved = saved.find((r) => r.variant_id === winner.id)
    if (!winnerSaved) {
      return NextResponse.json({ error: 'failed to save winner script' }, { status: 500 })
    }

    // Re-match category against the winning topic+script — gives
    // a sharper signal than the plan topic alone.
    const finalMatch = matchCategory(
      `${winner.topic} ${winner.script.slice(0, 400)}`,
      categories
    )
    const matchedCategory = finalMatch?.category ?? preMatch?.category ?? null
    const folderId =
      body.photoFolderId?.trim() ||
      matchedCategory?.drive_folder_id ||
      null

    // Render slides for the winning script.
    const style = await loadStyleTemplate(clinicId)
    const { slides } = await splitScriptToSlides(winner.script)

    let photoUrls: (string | null)[] = slides.map(() => null)
    if (folderId && style.background.type === 'photo') {
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
      style
    )

    const slideSet = await createSlideSet({
      clinicId,
      scriptId: winnerSaved.id,
      slides,
      styleTemplate: style,
      driveFolderId: folderId,
      categoryId: matchedCategory?.id ?? null,
      status: 'rendered',
    })

    // Mark plan topic done and link to the script.
    await updateTopic(topicId, {
      status: 'done',
      last_script_id: winnerSaved.id,
    })

    return NextResponse.json({
      slide_set_id: slideSet.id,
      script_id: winnerSaved.id,
      topic: winner.topic,
      hook: winner.hook,
      script: winner.script,
      slides,
      previews: buffers.map((b) => `data:image/png;base64,${b.toString('base64')}`),
      download_url: `/api/visual/download?slideSetId=${slideSet.id}`,
      category: matchedCategory
        ? {
            id: matchedCategory.id,
            slug: matchedCategory.slug,
            name: matchedCategory.name,
            emoji: matchedCategory.emoji,
          }
        : null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
