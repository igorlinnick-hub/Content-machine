// Official iframe embeds for reference reels we deliberately do NOT copy
// into our bucket.
//
// Instagram CDN links expire within hours, so the TikTok approach (pull the
// mp4 through Apify, store it) does not transfer: we'd be re-downloading
// forever. The official embed player costs no storage, needs no scraper, and
// keeps the post's own caption on screen — which is context the MA wants
// anyway. Trade-off: if the author deletes the post, the card goes blank.

export type EmbedPlatform = 'instagram' | 'tiktok' | 'youtube'

export interface ParsedEmbed {
  platform: EmbedPlatform
  embedUrl: string
  // Canonical post URL, stripped of tracking params (?igsh=, ?si=, …).
  canonicalUrl: string
}

// /reel/<code>/, /p/<code>/ and /tv/<code>/ all embed the same way.
const IG = /instagram\.com\/(?:[^/]+\/)?(reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i
const TIKTOK = /tiktok\.com\/(?:@[^/]+\/)?video\/(\d+)/i
const YT = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i

export function parseEmbed(rawUrl: string): ParsedEmbed | null {
  const url = rawUrl.trim()
  if (!url) return null

  const ig = url.match(IG)
  if (ig) {
    const code = ig[2]
    // Everything normalises to /p/: it is the one path that embeds every
    // post type (reels included, /reel/ is not guaranteed for photos), and
    // collapsing the forms means the same post pasted as /p/ and as /reel/
    // dedupes to one row. Instagram redirects /p/ back to /reel/ in the
    // browser, so "open the original" still lands in the right place.
    return {
      platform: 'instagram',
      embedUrl: `https://www.instagram.com/p/${code}/embed/`,
      canonicalUrl: `https://www.instagram.com/p/${code}/`,
    }
  }

  const tt = url.match(TIKTOK)
  if (tt) {
    return {
      platform: 'tiktok',
      embedUrl: `https://www.tiktok.com/embed/v2/${tt[1]}`,
      canonicalUrl: url.split('?')[0],
    }
  }

  const yt = url.match(YT)
  if (yt) {
    return {
      platform: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${yt[1]}`,
      canonicalUrl: `https://www.youtube.com/watch?v=${yt[1]}`,
    }
  }

  return null
}

// The handle in the URL, when the platform puts it there (TikTok, and
// Instagram profile-style reel links). Instagram's /reel/<code>/ form
// carries no handle — the embed shows it, we just can't read it server-side.
export function handleFromUrl(rawUrl: string): string | null {
  const m = rawUrl.match(/(?:tiktok\.com|instagram\.com)\/@?([A-Za-z0-9._]+)\//)
  if (!m) return null
  const h = m[1]
  if (['reel', 'reels', 'p', 'tv', 'video', 'www'].includes(h.toLowerCase())) return null
  return `@${h}`
}
