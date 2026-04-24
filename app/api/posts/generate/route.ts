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

    // 3 variants on the same topic, then critic picks the best.
    const writerOut = await runWriter({
      context,
      topicHint: planTopic.topic,
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

    // Render slides for the winning script.
    const style = await loadStyleTemplate(clinicId)
    const { slides } = await splitScriptToSlides(winner.script)

    let photoUrls: (string | null)[] = slides.map(() => null)
    if (body.photoFolderId && style.background.type === 'photo') {
      try {
        const photos = await getPhotosFromFolder(body.photoFolderId)
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
      driveFolderId: body.photoFolderId ?? null,
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
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
