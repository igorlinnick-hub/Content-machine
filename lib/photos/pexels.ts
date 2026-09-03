// Pexels stock search.
//
// Until now this lived ONLY inside the compose-runner skill as a curl the
// agent typed by hand (SKILL.md §photos) — the server had no way to resolve a
// `source:"stock"` photo brief at all, which is why lib/canva/orchestrator.ts
// silently skipped every stock slide. The in-house renderer needs it in code.

const ENDPOINT = 'https://api.pexels.com/v1/search'

export interface PexelsPhoto {
  url: string
  photographer: string
  id: number
}

export function pexelsIsConfigured(): boolean {
  return !!process.env.PEXELS_API_KEY?.trim()
}

/**
 * Portrait photo for a set of keywords, or null when the key is missing / the
 * query comes back empty — the caller falls back to photoreal Flux, matching
 * the runner's rule ("use real stock, not AI" — Igor 2026-07-30, with Flux as
 * the fallback rather than an abstract placeholder).
 */
export async function searchPexelsPortrait(
  keywords: string[],
  opts: { skip?: Set<number> } = {}
): Promise<PexelsPhoto | null> {
  const key = process.env.PEXELS_API_KEY?.trim()
  if (!key) return null
  const query = keywords.filter(Boolean).join(' ').trim()
  if (!query) return null

  const url = `${ENDPOINT}?query=${encodeURIComponent(query)}&orientation=portrait&per_page=15`
  // Hard timeout: a stock lookup must never be able to hang a render. Without
  // it a slow Pexels response holds the whole route until the platform kills it.
  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), 12_000)
  let res: Response
  try {
    res = await fetch(url, {
      headers: { Authorization: key },
      cache: 'no-store',
      signal: abort.signal,
    })
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) return null

  const data = (await res.json().catch(() => null)) as {
    photos?: Array<{
      id: number
      photographer?: string
      src?: { portrait?: string; large2x?: string; large?: string; original?: string }
    }>
  } | null

  for (const photo of data?.photos ?? []) {
    if (opts.skip?.has(photo.id)) continue
    // portrait crop first — the canvas is 4:5, so a landscape original would
    // lose its subject to the crop.
    const src = photo.src?.portrait ?? photo.src?.large2x ?? photo.src?.large ?? photo.src?.original
    if (src) {
      return { url: src, photographer: photo.photographer ?? '', id: photo.id }
    }
  }
  return null
}
