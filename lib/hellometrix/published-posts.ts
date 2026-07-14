import { createServerClient } from '@/lib/supabase/server'

// ── Hellometrix integration ────────────────────────────────────────────────────
// Reads published Instagram posts from the shared Supabase instance.
// Both projects live on the same DB so no API layer is needed.
//
// TABLE: update this constant to match the actual Hellometrix table name.
// COLUMNS: update the .select() below to match Hellometrix schema.
const HM_TABLE = 'instagram_media'
const HM_COLUMNS = 'caption, timestamp, reach, saved, like_count'

export interface PublishedPost {
  caption: string
  published_at: string
  reach: number | null
  saves: number | null
  likes: number | null
}

export async function getPublishedPosts(
  clinicId: string,
  limit = 30
): Promise<PublishedPost[]> {
  const supabase = createServerClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any
  const { data, error } = await client
    .from(HM_TABLE)
    .select(HM_COLUMNS)
    .eq('clinic_id', clinicId)
    .order('timestamp', { ascending: false })
    .limit(limit)

  if (error || !data) return []

  return (data as unknown as Array<Record<string, unknown>>).map((row) => ({
    caption: String(row.caption ?? ''),
    published_at: String(row.timestamp ?? ''),
    reach: typeof row.reach === 'number' ? row.reach : null,
    saves: typeof row.saved === 'number' ? row.saved : null,
    likes: typeof row.like_count === 'number' ? row.like_count : null,
  }))
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
  lines.push(`Recently published topics (avoid repeating these in the new plan):`)
  for (const p of posts.slice(0, 20)) {
    const snippet = p.caption.slice(0, 80).replace(/\n/g, ' ')
    lines.push(`  - "${snippet}"`)
  }

  return lines.join('\n')
}
