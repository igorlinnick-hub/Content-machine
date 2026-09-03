import { generateImages } from '@/lib/replicate/images'
import { searchPexelsPortrait } from './pexels'
import type { PostPlanPhotoBrief } from '@/types'

// photo_brief → one image URL per slide.
//
// Same three sources the compose-runner skill uses, in the same order, so the
// in-house render and the Canva render pull from one photo doctrine:
//   ai       → Flux 1.1 pro ultra, the stored prompt verbatim
//   stock    → Pexels, falling back to photoreal Flux
//   fallback → no photo; the skin draws its branded surface

export interface ResolvedPhoto {
  n: number
  url: string | null
  source: 'ai' | 'stock' | 'none'
  costUsd: number
}

const FLUX_ULTRA_USD = 0.06

async function flux(prompt: string): Promise<string | null> {
  try {
    const res = await generateImages({
      model: 'flux_pro_ultra',
      input: { prompt, aspect_ratio: '4:5', num_outputs: 1 },
      maxWaitMs: 120_000,
    })
    return res.imageUrls[0] ?? null
  } catch {
    return null
  }
}

async function resolveOne(brief: PostPlanPhotoBrief, usedStock: Set<number>): Promise<ResolvedPhoto> {
  if (brief.source === 'fallback') {
    return { n: brief.n, url: null, source: 'none', costUsd: 0 }
  }

  if (brief.source === 'stock') {
    const keywords = brief.keywords?.length ? brief.keywords : [brief.subject]
    const hit = await searchPexelsPortrait(keywords, { skip: usedStock })
    if (hit) {
      usedStock.add(hit.id)
      return { n: brief.n, url: hit.url, source: 'stock', costUsd: 0 }
    }
    // No key or nothing usable → photoreal Flux, never an abstract placeholder.
    const prompt =
      brief.prompt ??
      `Photorealistic editorial photograph: ${brief.subject}. Natural light, muted teal and amber palette, dark lower third, no text, no watermark.`
    const url = await flux(prompt)
    return { n: brief.n, url, source: url ? 'ai' : 'none', costUsd: url ? FLUX_ULTRA_USD : 0 }
  }

  const prompt = brief.prompt?.trim()
  if (!prompt) return { n: brief.n, url: null, source: 'none', costUsd: 0 }
  const url = await flux(prompt)
  return { n: brief.n, url, source: url ? 'ai' : 'none', costUsd: url ? FLUX_ULTRA_USD : 0 }
}

/**
 * Resolves every brief. Flux is rate-limited on this account (6/min, burst 1 —
 * the runner spaces calls ~11s apart), so AI slides are resolved SEQUENTIALLY;
 * Pexels lookups are cheap and ride along in the same pass.
 */
export async function resolvePhotos(briefs: PostPlanPhotoBrief[]): Promise<ResolvedPhoto[]> {
  const usedStock = new Set<number>()
  const out: ResolvedPhoto[] = []
  for (const brief of briefs) {
    out.push(await resolveOne(brief, usedStock))
  }
  return out
}
