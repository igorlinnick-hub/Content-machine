import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import {
  generateImages,
  IMAGE_MODELS,
  type ImageAspect,
  type ImageModelKey,
} from '@/lib/replicate/images'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Image gen can take 20-40s on Flux Pro. Vercel hobby cap is 300s.
export const maxDuration = 90

// Admin-only "lab" surface for experimenting with image prompts on
// Replicate. Returns the result URLs straight from Replicate — we do
// NOT save anything to Supabase here (separate "save to library" step
// later). Cost is best-effort estimated client-side from the model
// choice so the admin sees what each iteration roughly costs before
// hammering the button.

interface Body {
  prompt?: string
  model?: ImageModelKey
  aspect_ratio?: ImageAspect
  num_outputs?: number
  negative_prompt?: string
  seed?: number
}

const ASPECTS = new Set<ImageAspect>(['1:1', '4:5', '9:16', '16:9', '3:4'])

export async function POST(req: Request) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json(
      { error: 'admin access required' },
      { status: 403 }
    )
  }
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  const prompt = body.prompt?.trim()
  if (!prompt) {
    return NextResponse.json({ error: 'prompt required' }, { status: 400 })
  }
  const model: ImageModelKey =
    body.model && body.model in IMAGE_MODELS ? body.model : 'flux_schnell'
  const aspect_ratio: ImageAspect =
    body.aspect_ratio && ASPECTS.has(body.aspect_ratio)
      ? body.aspect_ratio
      : '1:1'
  const num_outputs = Math.max(1, Math.min(body.num_outputs ?? 1, 4))

  try {
    const result = await generateImages({
      model,
      input: {
        prompt,
        aspect_ratio,
        num_outputs,
        negative_prompt: body.negative_prompt,
        seed: body.seed,
      },
    })
    return NextResponse.json({ ok: true, result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
