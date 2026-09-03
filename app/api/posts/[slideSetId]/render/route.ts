import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { checkServiceToken } from '@/lib/posts/pipeline'
import { renderSlideSet } from '@/lib/render/compose'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Chromium cold start + up to ~7 Flux images at ~11s apart.
export const maxDuration = 300

// POST /api/posts/:slideSetId/render — draw the carousel HERE instead of in
// Canva. Writes slide_sets.render_preview and returns it; render_result and
// the compose status machine are untouched, so this is safe to run against a
// post that already has a Canva carousel (that is the point during R1 — the
// two sit side by side for comparison).
export async function POST(
  req: Request,
  { params }: { params: { slideSetId: string } }
) {
  if (!checkServiceToken(req)) {
    const access = await resolveAccess()
    if (!access || access.role !== 'admin') {
      return NextResponse.json({ error: 'admin access required' }, { status: 403 })
    }
  }

  const url = new URL(req.url)
  const styleParam = url.searchParams.get('style')
  const styleId = styleParam ? Number(styleParam) : undefined
  if (styleParam && (!Number.isInteger(styleId) || styleId! < 1 || styleId! > 5)) {
    return NextResponse.json({ error: 'style must be 1-5' }, { status: 400 })
  }

  try {
    const preview = await renderSlideSet({ slideSetId: params.slideSetId, styleId })
    return NextResponse.json({ ok: true, preview })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
