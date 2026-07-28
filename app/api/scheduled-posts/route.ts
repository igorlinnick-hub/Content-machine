import { NextRequest, NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'

// Supabase types don't know about this table until we regenerate after migration.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (sb: ReturnType<typeof createServerClient>) => (sb as any).from('scheduled_posts')

// GET /api/scheduled-posts?clinicId=xxx&from=ISO&to=ISO
export async function GET(req: NextRequest) {
  const access = await resolveAccess()
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const clinicId = access.role === 'admin'
    ? (searchParams.get('clinicId') ?? '')
    : access.clinicId
  if (!clinicId) return NextResponse.json({ error: 'clinicId required' }, { status: 400 })

  const from = searchParams.get('from')
  const to   = searchParams.get('to')

  const supabase = createServerClient()
  let q = table(supabase)
    .select('id, slide_set_id, caption, media_url, channels, scheduled_at, buffer_ids, status, created_at')
    .eq('clinic_id', clinicId)
    .order('scheduled_at', { ascending: true, nullsFirst: false })

  if (from) q = q.gte('scheduled_at', from)
  if (to)   q = q.lte('scheduled_at', to)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}

// POST /api/scheduled-posts — create + send to Buffer
export async function POST(req: NextRequest) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    clinicId: string
    slideSetId?: string
    caption: string
    mediaUrl?: string
    channels: string[]
    scheduledAt?: string
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.channels?.length) return NextResponse.json({ error: 'channels required' }, { status: 400 })
  if (!body.caption) return NextResponse.json({ error: 'caption required' }, { status: 400 })

  // Push to Buffer. Never swallow failures: every channel gets an explicit
  // result (postId or error) that we return to the client alongside the row.
  const bufferIds: Record<string, string> = {}
  let bufferResults: Array<{ channel: string; postId?: string; status?: string; error?: string }> = []
  try {
    const bufferRes = await fetch(`${req.nextUrl.origin}/api/publish/buffer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: req.headers.get('cookie') ?? '' },
      body: JSON.stringify({
        channels: body.channels,
        text: body.caption,
        mediaUrls: body.mediaUrl ? [body.mediaUrl] : [],
        scheduledAt: body.scheduledAt,
      }),
    })
    // publish/buffer returns per-channel results even on 502 (all failed)
    const bjson = await bufferRes.json().catch(() => null) as
      { results?: Array<{ channel: string; postId?: string; status?: string; error?: string }> } | null
    bufferResults = bjson?.results ?? body.channels.map(ch => ({
      channel: ch, error: `Buffer request failed (HTTP ${bufferRes.status})`,
    }))
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Buffer unreachable'
    bufferResults = body.channels.map(ch => ({ channel: ch, error: msg }))
  }
  for (const r of bufferResults) {
    if (r.postId) bufferIds[r.channel] = r.postId
  }

  // 'failed' only when the user asked to schedule and nothing reached Buffer;
  // a deliberate draft with no Buffer config stays a draft.
  const anySent = Object.keys(bufferIds).length > 0
  const status = anySent
    ? (body.scheduledAt ? 'scheduled' : 'draft')
    : (body.scheduledAt ? 'failed' : 'draft')

  const supabase = createServerClient()
  const { data, error } = await table(supabase)
    .insert({
      clinic_id:    body.clinicId,
      slide_set_id: body.slideSetId ?? null,
      caption:      body.caption,
      media_url:    body.mediaUrl ?? null,
      channels:     body.channels,
      scheduled_at: body.scheduledAt ?? null,
      buffer_ids:   bufferIds,
      status,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ...data, buffer_results: bufferResults })
}
