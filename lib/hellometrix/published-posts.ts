import { createServerClient } from '@/lib/supabase/server'

// ── Hellometrix integration ────────────────────────────────────────────────────
// Pulls published Instagram posts via the Hellometrix internal API.
// Hellometrix is on a separate Supabase project — accessed via HTTP, not direct DB.
//
// Env vars required in Vercel:
//   HELLOMETRIX_API_URL  — base URL, e.g. https://dashboard-hwc.vercel.app
//   HELLOMETRIX_API_KEY  — shared bearer token (CM_API_KEY on Hellometrix side)
//
// The clinic row must have hellometrix_client_id set (migration 042).
// reach/saves are null until Hellometrix gets instagram_manage_insights scope.

export interface PublishedPost {
  caption: string
  published_at: string
  reach: number | null
  saves: number | null
  likes: number | null
}

interface HellometrixPost {
  ig_id: string
  caption: string
  timestamp: string
  media_type: string
  permalink: string
  likes: number | null
  comments: number | null
  reach: number | null
  saves: number | null
}

export async function getPublishedPosts(
  clinicId: string,
  limit = 30
): Promise<PublishedPost[]> {
  const apiUrl = process.env.HELLOMETRIX_API_URL
  const apiKey = process.env.HELLOMETRIX_API_KEY
  if (!apiUrl || !apiKey) return []

  // Resolve Hellometrix client ID for this clinic
  const supabase = createServerClient()
  const { data: clinic } = await supabase
    .from('clinics')
    .select('hellometrix_client_id')
    .eq('id', clinicId)
    .single()

  const hmClientId = clinic?.hellometrix_client_id
  if (!hmClientId) return []

  try {
    const res = await fetch(
      `${apiUrl}/api/cm/recent-posts?clientId=${hmClientId}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        next: { revalidate: 7200 }, // respect Hellometrix 2h cache
      }
    )
    if (!res.ok) return []
    const json = await res.json() as { posts?: HellometrixPost[] }
    const posts = json.posts ?? []

    return posts.slice(0, limit).map((p) => ({
      caption: p.caption ?? '',
      published_at: p.timestamp ?? '',
      reach: typeof p.reach === 'number' ? p.reach : null,
      saves: typeof p.saves === 'number' ? p.saves : null,
      likes: typeof p.likes === 'number' ? p.likes : null,
    }))
  } catch {
    return []
  }
}

export function buildPublishedContext(posts: PublishedPost[]): string {
  if (!posts.length) return ''

  // Sort by engagement — reach+saves when available, else likes
  const scored = posts.map((p) => ({
    ...p,
    score: (p.saves ?? 0) * 3 + (p.reach ?? 0) + (p.likes ?? 0) * 2,
  }))
  const top = [...scored]
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  const lines: string[] = []

  if (top.length) {
    lines.push('Top-performing recent posts (by engagement):')
    for (const p of top) {
      const snippet = p.caption.slice(0, 80).replace(/\n/g, ' ')
      const metrics = [
        p.saves != null ? `${p.saves} saves` : null,
        p.reach != null ? `${p.reach} reach` : null,
        p.likes != null ? `${p.likes} likes` : null,
      ].filter(Boolean).join(' / ')
      lines.push(`  - "${snippet}" — ${metrics}`)
    }
  }

  lines.push('')
  lines.push('Recently published topics (avoid repeating in the new plan):')
  for (const p of posts.slice(0, 20)) {
    const snippet = p.caption.slice(0, 80).replace(/\n/g, ' ')
    lines.push(`  - "${snippet}"`)
  }

  return lines.join('\n')
}
