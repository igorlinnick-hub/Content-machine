import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { runVideoPrompter } from '@/lib/agents/video-prompter'
import {
  generateSeedanceVideo,
  MODEL_SEEDANCE_LITE,
  MODEL_SEEDANCE_PRO,
  type SeedanceAspect,
  type SeedanceDuration,
} from '@/lib/replicate/client'
import {
  createVideoSet,
  markVideoFailed,
  markVideoRendered,
  uploadVideoFromUrl,
} from '@/lib/videos/store'
import { ensureDefaultCategories, matchCategory } from '@/lib/posts/categories'

export const runtime = 'nodejs'
// Seedance generations + upload can take 30-180s depending on model.
export const maxDuration = 300

interface Body {
  clinicId?: string
  topic?: string
  scriptId?: string
  scriptText?: string
  duration?: SeedanceDuration
  aspect?: SeedanceAspect
  resolution?: '480p' | '720p' | '1080p'
  // 'lite' = cheaper / faster, 'pro' = better quality, more $$.
  quality?: 'lite' | 'pro'
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
  const topic = body.topic?.trim()
  if (!clinicId || !topic) {
    return NextResponse.json(
      { error: 'clinicId and topic required' },
      { status: 400 }
    )
  }

  const duration: SeedanceDuration = body.duration ?? 5
  const aspect: SeedanceAspect = body.aspect ?? '9:16'
  const resolution = body.resolution ?? '720p'
  const quality = body.quality ?? 'lite'
  const model = quality === 'pro' ? MODEL_SEEDANCE_PRO : MODEL_SEEDANCE_LITE

  let videoSetId: string | null = null
  try {
    const categories = await ensureDefaultCategories(clinicId)
    const matched = matchCategory(topic, categories)?.category ?? null

    // Step 1 — prompter agent (Haiku) turns topic + (optional) script
    // into a Seedance prompt.
    const prompt = await runVideoPrompter({
      topic,
      script: body.scriptText ?? null,
      category: matched?.name ?? null,
      durationSec: duration === 15 ? 10 : duration,
      aspectRatio: aspect,
    })

    // Step 2 — register the video set as pending so the UI can show it.
    const created = await createVideoSet({
      clinicId,
      scriptId: body.scriptId ?? null,
      prompt: prompt.prompt,
      duration_sec: duration,
      aspect_ratio: aspect,
      resolution,
      categoryId: matched?.id ?? null,
      replicate_model: model,
      status: 'generating',
    })
    videoSetId = created.id

    // Step 3 — call Replicate, wait for the mp4 URL.
    const result = await generateSeedanceVideo({
      model,
      input: {
        prompt: prompt.prompt,
        duration,
        aspect_ratio: aspect,
        resolution,
      },
    })

    // Step 4 — mirror the mp4 to Supabase Storage so we own the URL.
    const stored = await uploadVideoFromUrl({
      clinicId,
      videoId: created.id,
      sourceUrl: result.videoUrl,
    })

    await markVideoRendered({
      id: created.id,
      replicate_prediction_id: result.id,
      storage_path: stored.storage_path,
      public_url: stored.public_url,
    })

    return NextResponse.json({
      video_id: created.id,
      prompt: prompt.prompt,
      public_url: stored.public_url,
      duration_sec: duration,
      aspect_ratio: aspect,
      resolution,
      replicate_prediction_id: result.id,
      replicate_model: model,
      predict_time_sec: result.predictTime,
      category: matched
        ? {
            id: matched.id,
            slug: matched.slug,
            name: matched.name,
            emoji: matched.emoji,
          }
        : null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    if (videoSetId) {
      await markVideoFailed(videoSetId, msg).catch(() => {})
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
