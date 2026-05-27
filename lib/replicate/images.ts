// Replicate image generation. Companion to client.ts (which handles
// Seedance video). Three pinned models so the admin can compare
// quality vs cost from the /lab page without typing model strings:
//
//   flux-schnell  — fast + cheap (~$0.003 / image, 4-step). Default.
//   flux-1.1-pro  — best quality currently (~$0.04 / image).
//   sdxl-lightning — fastest SDXL variant (~$0.0019 / image).
//
// All models accept the same `prompt + aspect_ratio + num_outputs`
// shape from our side; differences live in the per-model `input`
// fields below. Output is always a public URL array we can render.

const REPLICATE_API = 'https://api.replicate.com/v1'

export const IMAGE_MODELS = {
  flux_schnell: 'black-forest-labs/flux-schnell',
  flux_pro: 'black-forest-labs/flux-1.1-pro',
  sdxl_lightning: 'bytedance/sdxl-lightning-4step',
} as const

export type ImageModelKey = keyof typeof IMAGE_MODELS

export type ImageAspect = '1:1' | '4:5' | '9:16' | '16:9' | '3:4'

export interface ImageGenInput {
  prompt: string
  aspect_ratio?: ImageAspect
  num_outputs?: number
  // Optional negative-style guidance for SDXL — Flux ignores this.
  negative_prompt?: string
  seed?: number
}

export interface ImageGenResult {
  id: string
  model: ImageModelKey
  prompt: string
  imageUrls: string[]
  predictTime: number
  cost_estimate_usd: number
}

interface PredictionResponse {
  id: string
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled'
  output: string | string[] | null
  error: string | null
  metrics?: { predict_time?: number }
}

function token(): string {
  const t = process.env.REPLICATE_API_TOKEN
  if (!t) throw new Error('REPLICATE_API_TOKEN not configured')
  return t
}

// Rough per-image cost estimates (May 2026 prices). Used only for
// the UI hint — Replicate bills actual usage, this is a heuristic.
function estimateCost(model: ImageModelKey, count: number): number {
  const per: Record<ImageModelKey, number> = {
    flux_schnell: 0.003,
    flux_pro: 0.04,
    sdxl_lightning: 0.0019,
  }
  return (per[model] ?? 0.005) * Math.max(1, count)
}

// Maps our shared input shape to each model's actual schema.
function buildInput(
  model: ImageModelKey,
  input: ImageGenInput
): Record<string, unknown> {
  const aspect = input.aspect_ratio ?? '1:1'
  const num = Math.max(1, Math.min(input.num_outputs ?? 1, 4))
  const seed = typeof input.seed === 'number' ? input.seed : undefined
  if (model === 'flux_schnell' || model === 'flux_pro') {
    // Flux models accept aspect_ratio + num_outputs directly. Pro
    // also takes prompt_upsampling but we leave it off — admin's
    // prompts already tend to be specific.
    return {
      prompt: input.prompt,
      aspect_ratio: aspect,
      num_outputs: num,
      output_format: 'png',
      output_quality: 90,
      ...(seed !== undefined ? { seed } : {}),
    }
  }
  // sdxl-lightning-4step — needs width/height instead of aspect_ratio.
  const dims = aspectToDims(aspect)
  return {
    prompt: input.prompt,
    negative_prompt:
      input.negative_prompt ?? 'low quality, blurry, watermark, text',
    num_outputs: num,
    width: dims.w,
    height: dims.h,
    scheduler: 'K_EULER',
    num_inference_steps: 4,
    ...(seed !== undefined ? { seed } : {}),
  }
}

function aspectToDims(a: ImageAspect): { w: number; h: number } {
  switch (a) {
    case '1:1':
      return { w: 1024, h: 1024 }
    case '4:5':
      return { w: 1024, h: 1280 }
    case '9:16':
      return { w: 768, h: 1344 }
    case '16:9':
      return { w: 1344, h: 768 }
    case '3:4':
      return { w: 1024, h: 1365 }
  }
}

async function startPrediction(
  modelKey: ImageModelKey,
  input: ImageGenInput
): Promise<PredictionResponse> {
  const slug = IMAGE_MODELS[modelKey]
  const res = await fetch(`${REPLICATE_API}/models/${slug}/predictions`, {
    method: 'POST',
    headers: {
      authorization: `Token ${token()}`,
      'content-type': 'application/json',
      Prefer: 'wait=60',
    },
    body: JSON.stringify({ input: buildInput(modelKey, input) }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Replicate ${res.status}: ${text.slice(0, 500)}`)
  }
  return (await res.json()) as PredictionResponse
}

async function waitForPrediction(
  id: string,
  maxWaitMs: number
): Promise<PredictionResponse> {
  const start = Date.now()
  while (Date.now() - start < maxWaitMs) {
    const r = await fetch(`${REPLICATE_API}/predictions/${id}`, {
      headers: { authorization: `Token ${token()}` },
    })
    if (!r.ok) throw new Error(`Replicate poll ${r.status}`)
    const p = (await r.json()) as PredictionResponse
    if (
      p.status === 'succeeded' ||
      p.status === 'failed' ||
      p.status === 'canceled'
    ) {
      return p
    }
    await new Promise((res) => setTimeout(res, 2000))
  }
  throw new Error('Replicate image gen timed out')
}

export async function generateImages(params: {
  model: ImageModelKey
  input: ImageGenInput
  maxWaitMs?: number
}): Promise<ImageGenResult> {
  const initial = await startPrediction(params.model, params.input)
  const final =
    initial.status === 'succeeded' || initial.status === 'failed'
      ? initial
      : await waitForPrediction(initial.id, params.maxWaitMs ?? 120_000)
  if (final.status !== 'succeeded') {
    throw new Error(
      `Replicate ${params.model} failed: ${final.error ?? final.status}`
    )
  }
  const urls = Array.isArray(final.output)
    ? final.output.filter((s) => typeof s === 'string')
    : typeof final.output === 'string'
      ? [final.output]
      : []
  if (urls.length === 0) {
    throw new Error('Replicate succeeded with no image URLs')
  }
  return {
    id: final.id,
    model: params.model,
    prompt: params.input.prompt,
    imageUrls: urls,
    predictTime: final.metrics?.predict_time ?? 0,
    cost_estimate_usd: estimateCost(params.model, urls.length),
  }
}
