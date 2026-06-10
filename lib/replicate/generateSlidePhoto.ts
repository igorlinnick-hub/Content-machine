import { generateImages } from './images'

// Thin wrapper around Flux Schnell tuned for our slide pipeline:
//   - aspect ratio locked to 4:5 (Instagram slide canvas)
//   - one output per call (no A/B inside the generator — that's a
//     separate post-level decision)
//   - returns raw PNG bytes ready for Drive upload (caller doesn't
//     have to refetch the URL)
//
// No business logic: prompt building stays in lib/visual/photoPrompts.
// Cache decisions stay in lib/visual/photoFiller. This module only
// translates "give me a PNG for this prompt" into Replicate + a
// network fetch of the resulting URL.

export interface GenerateSlidePhotoResult {
  bytes: Buffer
  mimeType: 'image/png'
  promptUsed: string
  costEstimateUsd: number
  predictTime: number
}

export async function generateSlidePhoto(
  prompt: string,
  opts: { seed?: number; maxWaitMs?: number } = {}
): Promise<GenerateSlidePhotoResult> {
  const result = await generateImages({
    model: 'flux_schnell',
    input: {
      prompt,
      aspect_ratio: '4:5',
      num_outputs: 1,
      seed: opts.seed,
    },
    maxWaitMs: opts.maxWaitMs ?? 60_000,
  })

  const url = result.imageUrls[0]
  if (!url) throw new Error('generateSlidePhoto: empty imageUrls')

  // Replicate URLs are short-lived signed CDN. Fetch the bytes now so
  // the caller can pipe straight to Drive without worrying about the
  // URL expiring mid-pipeline.
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(
      `generateSlidePhoto: fetch ${url} -> ${res.status} ${res.statusText}`
    )
  }
  const ab = await res.arrayBuffer()
  return {
    bytes: Buffer.from(ab),
    mimeType: 'image/png',
    promptUsed: prompt,
    costEstimateUsd: result.cost_estimate_usd,
    predictTime: result.predictTime,
  }
}
