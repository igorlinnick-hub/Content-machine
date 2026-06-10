import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import {
  loadTrendSources,
  upsertTrendSource,
  type TrendPlatform,
  type TrendKind,
} from '@/lib/trends/sources'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PLATFORMS: TrendPlatform[] = ['instagram', 'tiktok', 'youtube']
const KINDS: TrendKind[] = ['account', 'hashtag']

interface PostBody {
  clinicId?: string
  platform?: string
  kind?: string
  handle_or_hashtag?: string
  notes?: string
}

export async function GET(req: Request) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }
  const clinicId = new URL(req.url).searchParams.get('clinicId')
  if (!clinicId)
    return NextResponse.json({ error: 'clinicId required' }, { status: 400 })
  const sources = await loadTrendSources(clinicId)
  return NextResponse.json({ ok: true, sources })
}

export async function POST(req: Request) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }
  let body: PostBody
  try {
    body = (await req.json()) as PostBody
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  const clinicId = body.clinicId?.trim()
  const handle = body.handle_or_hashtag?.trim()
  if (!clinicId || !handle) {
    return NextResponse.json(
      { error: 'clinicId and handle_or_hashtag required' },
      { status: 400 }
    )
  }
  if (!PLATFORMS.includes(body.platform as TrendPlatform)) {
    return NextResponse.json({ error: 'invalid platform' }, { status: 400 })
  }
  if (!KINDS.includes(body.kind as TrendKind)) {
    return NextResponse.json({ error: 'invalid kind' }, { status: 400 })
  }
  const source = await upsertTrendSource({
    clinicId,
    platform: body.platform as TrendPlatform,
    kind: body.kind as TrendKind,
    handleOrHashtag: handle,
    notes: body.notes ?? null,
  })
  return NextResponse.json({ ok: true, source })
}
