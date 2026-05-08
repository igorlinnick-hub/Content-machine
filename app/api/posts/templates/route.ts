import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import {
  insertScriptTemplate,
  loadScriptTemplates,
  type ScriptTemplateLengthBias,
} from '@/lib/posts/templates'

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
    const templates = await loadScriptTemplates(clinicId, { activeOnly: false })
    return NextResponse.json({ templates })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

interface CreateBody {
  clinicId?: string
  name?: string
  description?: string | null
  scaffold?: string
  length_bias?: ScriptTemplateLengthBias | null
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }
  let body: CreateBody
  try {
    body = (await req.json()) as CreateBody
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  const clinicId = body.clinicId?.trim()
  if (!clinicId) {
    return NextResponse.json({ error: 'clinicId required' }, { status: 400 })
  }
  if (!body.name?.trim() || !body.scaffold?.trim()) {
    return NextResponse.json(
      { error: 'name and scaffold required' },
      { status: 400 }
    )
  }
  try {
    const template = await insertScriptTemplate(clinicId, {
      name: body.name,
      description: body.description ?? null,
      scaffold: body.scaffold,
      length_bias: body.length_bias ?? null,
    })
    return NextResponse.json({ template })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
