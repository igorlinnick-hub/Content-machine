import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import {
  deleteScriptTemplate,
  updateScriptTemplate,
  type ScriptTemplateLengthBias,
} from '@/lib/posts/templates'

export const runtime = 'nodejs'

async function requireAdmin() {
  const access = await resolveAccess()
  return access && access.role === 'admin' ? access : null
}

interface PatchBody {
  name?: string
  description?: string | null
  scaffold?: string
  length_bias?: ScriptTemplateLengthBias | null
  active?: boolean
  position?: number
}

export async function PATCH(
  req: Request,
  { params }: { params: { templateId: string } }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }
  let body: PatchBody
  try {
    body = (await req.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  try {
    const template = await updateScriptTemplate(params.templateId, body)
    return NextResponse.json({ template })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { templateId: string } }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }
  try {
    await deleteScriptTemplate(params.templateId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
