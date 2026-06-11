import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { resolveAccess } from '@/lib/auth/session'
import { checkServiceToken } from '@/lib/posts/pipeline'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// HANDOFF-POSTS.md §22.7 (Option A) — read endpoint for the Canva-bot.
//
// Returns the list of slide_sets currently graded ready_for_canva for
// the given clinic. The Canva-bot polls this on its schedule, picks the
// oldest row, assembles the carousel in Canva, then optionally POSTs
// back to flip status to in_canva / published (handled in a future
// session).
//
// Auth: either admin session (debugging) OR SERVICE_TOKEN header
// (the Canva-bot's normal path).
//
// Response:
//   {
//     posts: [
//       {
//         slide_set_id: string,
//         clinic_id: string,
//         script_id: string | null,
//         plan_id: string | null,
//         topic: string | null,
//         hook: string | null,
//         caption_short: string | null,
//         caption_long: string | null,
//         category: string | null,
//         created_at: string,
//         slides: TypedSlide[]    // structured slide content
//       }
//     ]
//   }
//
// We intentionally do NOT include the rendered preview data URLs here —
// they balloon the response. Canva-bot doesn't need them; it builds in
// Canva from the structured slides + caption text.

export async function GET(req: Request) {
  const isService = checkServiceToken(req)
  if (!isService) {
    const access = await resolveAccess()
    if (!access || access.role !== 'admin') {
      return NextResponse.json({ error: 'auth required' }, { status: 403 })
    }
  }

  const url = new URL(req.url)
  const clinicId = url.searchParams.get('clinicId')?.trim()
  const limit = Math.max(
    1,
    Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10) || 20, 100)
  )

  if (!clinicId) {
    return NextResponse.json({ error: 'clinicId required' }, { status: 400 })
  }

  const supabase = createServerClient()

  // ready_for_canva slide_sets + the joined script for caption text.
  const { data: rows, error } = await supabase
    .from('slide_sets')
    .select(
      'id, clinic_id, script_id, plan_id, slides, status, created_at, category_id, clinic_categories ( name ), scripts ( topic, hook, short_caption, long_caption )'
    )
    .eq('clinic_id', clinicId)
    .eq('status', 'ready_for_canva')
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const posts = (rows ?? []).map((r) => {
    const row = r as {
      id: string
      clinic_id: string | null
      script_id: string | null
      plan_id: string | null
      slides: unknown
      status: string | null
      created_at: string | null
      category_id: string | null
      clinic_categories?: { name?: string | null } | { name?: string | null }[] | null
      scripts?:
        | {
            topic?: string | null
            hook?: string | null
            short_caption?: string | null
            long_caption?: string | null
          }
        | Array<{
            topic?: string | null
            hook?: string | null
            short_caption?: string | null
            long_caption?: string | null
          }>
        | null
    }
    const cat = Array.isArray(row.clinic_categories)
      ? row.clinic_categories[0]
      : row.clinic_categories
    const script = Array.isArray(row.scripts) ? row.scripts[0] : row.scripts
    return {
      slide_set_id: row.id,
      clinic_id: row.clinic_id,
      script_id: row.script_id,
      plan_id: row.plan_id,
      topic: script?.topic ?? null,
      hook: script?.hook ?? null,
      caption_short: script?.short_caption ?? null,
      caption_long: script?.long_caption ?? null,
      category: cat?.name ?? null,
      created_at: row.created_at,
      slides: Array.isArray(row.slides) ? row.slides : [],
    }
  })

  return NextResponse.json({ posts })
}
