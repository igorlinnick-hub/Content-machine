// ── Hellometrix integration ────────────────────────────────────────────────────
// STATUS: stub — returns empty until Hellometrix exposes an API endpoint.
//
// Hellometrix is on a SEPARATE Supabase project (tvpirgeqvmdtbvnnjwlu).
// Instagram connector not yet built in Hellometrix (only mock data exists).
//
// When ready:
//   1. Add Instagram connector to Hellometrix (cached_data table, connector_slug='instagram')
//   2. Add GET /api/cm/published-posts?clinicId= endpoint to Hellometrix
//   3. Add HELLOMETRIX_API_URL + HELLOMETRIX_API_KEY to Content Machine Vercel env
//   4. Replace the stub below with a real fetch() call

export interface PublishedPost {
  caption: string
  published_at: string
  reach: number | null
  saves: number | null
  likes: number | null
}

export async function getPublishedPosts(
  _clinicId: string,
  _limit = 30
): Promise<PublishedPost[]> {
  // TODO: call Hellometrix API once Instagram connector is live
  return []
}

export function buildPublishedContext(posts: PublishedPost[]): string {
  if (!posts.length) return ''

  const top = [...posts]
    .filter((p) => (p.saves ?? 0) + (p.reach ?? 0) > 0)
    .sort((a, b) => (b.saves ?? 0) + (b.reach ?? 0) - ((a.saves ?? 0) + (a.reach ?? 0)))
    .slice(0, 5)

  const lines: string[] = []

  if (top.length) {
    lines.push('Top-performing recent posts (by saves + reach):')
    for (const p of top) {
      const snippet = p.caption.slice(0, 80).replace(/\n/g, ' ')
      lines.push(`  - "${snippet}" — ${p.saves ?? 0} saves / ${p.reach ?? 0} reach`)
    }
  }

  lines.push('')
  lines.push('Recently published topics (avoid repeating these in the new plan):')
  for (const p of posts.slice(0, 20)) {
    const snippet = p.caption.slice(0, 80).replace(/\n/g, ' ')
    lines.push(`  - "${snippet}"`)
  }

  return lines.join('\n')
}
