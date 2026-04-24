import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { updateTopic, deleteTopic } from '@/lib/posts/plan'

export const runtime = 'nodejs'

async function requireAdmin() {
  const access = await resolveAccess()
  return access && access.role === 'admin' ? access : null
}

export async function PATCH(
  req: Request,
  { params }: { params: { topicId: string } }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }
  let body: { status?: string; topic?: string }
  try {
    body = (await req.json()) as { status?: string; topic?: string }
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  const patch: { status?: 'pending' | 'done' | 'skipped'; topic?: string } = {}
  if (body.status === 'pending' || body.status === 'done' || body.status === 'skipped') {
    patch.status = body.status
  }
  if (typeof body.topic === 'string' && body.topic.trim()) {
    patch.topic = body.topic.trim()
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no valid fields to update' }, { status: 400 })
  }
  try {
    const topic = await updateTopic(params.topicId, patch)
    if (!topic) {
      return NextResponse.json({ error: 'topic not found' }, { status: 404 })
    }
    return NextResponse.json({ topic })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { topicId: string } }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }
  try {
    await deleteTopic(params.topicId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
