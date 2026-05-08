// Thin wrapper around Replicate's prediction API. Pay-as-you-go video
// generation — currently used for Seedance 2.0 lite (cheap path) and
// Seedance 2.0 pro (better quality). Both are billed per-second of
// generated video; expect ~$0.05-0.50 per 5-second clip depending on
// model. Token lives in REPLICATE_API_TOKEN env.

const REPLICATE_API = 'https://api.replicate.com/v1'

// Pinned model versions. Update when Replicate publishes new ones.
// Format: "owner/name" — Replicate resolves to the latest stable version.
export const MODEL_SEEDANCE_LITE = 'bytedance/seedance-2-0-lite'
export const MODEL_SEEDANCE_PRO = 'bytedance/seedance-2-0-pro'

function token(): string {
  const t = process.env.REPLICATE_API_TOKEN
  if (!t) throw new Error('REPLICATE_API_TOKEN not configured')
  return t
}

export type SeedanceAspect = '16:9' | '9:16' | '1:1' | '4:5'
export type SeedanceDuration = 4 | 5 | 6 | 8 | 10 | 15

export interface SeedanceInput {
  prompt: string
  duration?: SeedanceDuration   // seconds; default 5
  aspect_ratio?: SeedanceAspect // default 9:16 for vertical reels
  resolution?: '480p' | '720p' | '1080p'
  // Optional first/last frame images (URLs) for image-to-video.
  image?: string
  last_frame_image?: string
  seed?: number
}

export interface PredictionResponse {
  id: string
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled'
  output: string | string[] | null
  error: string | null
  metrics?: { predict_time?: number }
  urls: { get: string; cancel: string; stream?: string }
}

// Kick off a Seedance generation. Returns immediately with a prediction
// id; poll getPrediction(id) until status === 'succeeded'.
export async function startSeedance(
  model: typeof MODEL_SEEDANCE_LITE | typeof MODEL_SEEDANCE_PRO,
  input: SeedanceInput
): Promise<PredictionResponse> {
  const res = await fetch(`${REPLICATE_API}/models/${model}/predictions`, {
    method: 'POST',
    headers: {
      authorization: `Token ${token()}`,
      'content-type': 'application/json',
      // Use `wait` to block server-side up to 60s instead of polling
      // — Replicate returns the final result if it finishes that fast,
      // otherwise returns processing and we poll.
      Prefer: 'wait=60',
    },
    body: JSON.stringify({
      input: {
        duration: 5,
        aspect_ratio: '9:16',
        resolution: '720p',
        ...input,
      },
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Replicate ${res.status}: ${text.slice(0, 400)}`)
  }
  return (await res.json()) as PredictionResponse
}

export async function getPrediction(id: string): Promise<PredictionResponse> {
  const res = await fetch(`${REPLICATE_API}/predictions/${id}`, {
    headers: { authorization: `Token ${token()}` },
  })
  if (!res.ok) {
    throw new Error(`Replicate getPrediction ${res.status}`)
  }
  return (await res.json()) as PredictionResponse
}

// Poll a prediction every 2s up to maxWaitMs. Returns the final response.
export async function waitForPrediction(
  id: string,
  maxWaitMs = 240_000
): Promise<PredictionResponse> {
  const start = Date.now()
  // Replicate returns either a single mp4 URL or an array of frames;
  // for video models it's a single string URL.
  while (Date.now() - start < maxWaitMs) {
    const p = await getPrediction(id)
    if (p.status === 'succeeded' || p.status === 'failed' || p.status === 'canceled') {
      return p
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error(`waitForPrediction: timed out after ${maxWaitMs}ms`)
}

// Single-call helper. Starts the prediction, then waits for completion.
// Returns the final URL on success.
export async function generateSeedanceVideo(params: {
  model?: typeof MODEL_SEEDANCE_LITE | typeof MODEL_SEEDANCE_PRO
  input: SeedanceInput
  maxWaitMs?: number
}): Promise<{ id: string; videoUrl: string; predictTime: number }> {
  const model = params.model ?? MODEL_SEEDANCE_LITE
  const initial = await startSeedance(model, params.input)
  const final =
    initial.status === 'succeeded' || initial.status === 'failed'
      ? initial
      : await waitForPrediction(initial.id, params.maxWaitMs)

  if (final.status !== 'succeeded') {
    throw new Error(
      `Replicate ${model} failed: ${final.error ?? final.status}`
    )
  }
  const videoUrl =
    typeof final.output === 'string'
      ? final.output
      : Array.isArray(final.output) && final.output.length > 0
        ? final.output[0]
        : null
  if (!videoUrl) throw new Error('Replicate succeeded with no output URL')

  return {
    id: final.id,
    videoUrl,
    predictTime: final.metrics?.predict_time ?? 0,
  }
}
