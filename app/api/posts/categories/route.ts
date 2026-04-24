import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import {
  ensureDefaultCategories,
  replaceCategories,
  type CategoryInput,
} from '@/lib/posts/categories'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const access = await resolveAccess()
  return access && access.role === 'admin' ? access : null
}

export async function GET(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }
  const url = new URL(req.url)
  const clinicId = url.searchParams.get('clinicId')
  if (!clinicId) {
    return NextResponse.json({ error: 'clinicId required' }, { status: 400 })
  }
  try {
    const categories = await ensureDefaultCategories(clinicId)
    return NextResponse.json({ categories })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }
  let body: { clinicId?: string; categories?: unknown }
  try {
    body = (await req.json()) as { clinicId?: string; categories?: unknown }
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  const clinicId = body.clinicId?.trim()
  if (!clinicId) {
    return NextResponse.json({ error: 'clinicId required' }, { status: 400 })
  }
  if (!Array.isArray(body.categories)) {
    return NextResponse.json({ error: 'categories must be an array' }, { status: 400 })
  }
  const list: CategoryInput[] = []
  for (const raw of body.categories) {
    if (!raw || typeof raw !== 'object') continue
    const c = raw as Record<string, unknown>
    const slug = typeof c.slug === 'string' ? c.slug.trim() : ''
    const name = typeof c.name === 'string' ? c.name.trim() : ''
    if (!slug || !name) continue
    const triggers = Array.isArray(c.triggers)
      ? c.triggers.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean)
      : []
    list.push({
      slug,
      name,
      emoji: typeof c.emoji === 'string' ? c.emoji : null,
      triggers,
      drive_folder_id: typeof c.drive_folder_id === 'string' && c.drive_folder_id.trim()
        ? c.drive_folder_id.trim()
        : null,
      cta_template: typeof c.cta_template === 'string' && c.cta_template.trim()
        ? c.cta_template.trim()
        : null,
    })
  }
  try {
    const categories = await replaceCategories(clinicId, list)
    return NextResponse.json({ categories })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
