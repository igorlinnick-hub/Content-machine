import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import {
  deletePostReference,
  loadPostReferences,
  updatePostReferenceMeta,
  uploadPostReference,
  type PostReferenceMode,
  type PostReferenceRole,
} from '@/lib/posts/references'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BYTES = 8 * 1024 * 1024 // 8 MB per slide PNG

const ALLOWED_TYPES = new Set<string>([
  'image/png',
  'image/jpeg',
  'image/webp',
])

const VALID_MODES = new Set(['photo', 'clean'])
const VALID_ROLES = new Set(['cover', 'body', 'cta', 'full_post'])

function extFromContentType(ct: string): string {
  switch (ct) {
    case 'image/png':
      return 'png'
    case 'image/jpeg':
      return 'jpg'
    case 'image/webp':
      return 'webp'
    default:
      return 'bin'
  }
}

async function requireAdmin() {
  const access = await resolveAccess()
  return access && access.role === 'admin' ? access : null
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e) {
    const m = (e as { message?: unknown }).message
    if (typeof m === 'string' && m.length > 0) return m
  }
  return 'unknown error'
}

export async function GET(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'admin only' }, { status: 403 })
  }
  const url = new URL(req.url)
  const clinicId = url.searchParams.get('clinicId')
  if (!clinicId) {
    return NextResponse.json({ error: 'clinicId required' }, { status: 400 })
  }
  try {
    const references = await loadPostReferences(clinicId)
    return NextResponse.json({ references })
  } catch (e) {
    const msg = errorMessage(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'admin only' }, { status: 403 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json(
      { error: 'expected multipart/form-data' },
      { status: 400 }
    )
  }

  const clinicId = String(form.get('clinicId') ?? '').trim()
  const file = form.get('file')
  const label = (form.get('label') as string | null) ?? null
  const modeRaw = (form.get('mode') as string | null) ?? null
  const roleRaw = (form.get('role') as string | null) ?? null
  const categorySlug = (form.get('category_slug') as string | null) ?? null
  const notes = (form.get('notes') as string | null) ?? null

  if (!clinicId) {
    return NextResponse.json({ error: 'clinicId required' }, { status: 400 })
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file required' }, { status: 400 })
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'empty file' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'file too large (max 8 MB)' },
      { status: 413 }
    )
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `unsupported type ${file.type || 'unknown'}` },
      { status: 415 }
    )
  }

  const mode = modeRaw && VALID_MODES.has(modeRaw) ? (modeRaw as PostReferenceMode) : null
  const role = roleRaw && VALID_ROLES.has(roleRaw) ? (roleRaw as PostReferenceRole) : null

  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const reference = await uploadPostReference(
      clinicId,
      {
        bytes,
        contentType: file.type,
        ext: extFromContentType(file.type),
      },
      {
        label,
        mode,
        role,
        category_slug: categorySlug,
        notes,
      }
    )
    return NextResponse.json({ reference })
  } catch (e) {
    const msg = errorMessage(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'admin only' }, { status: 403 })
  }
  let body: {
    referenceId?: string
    label?: string | null
    mode?: string | null
    role?: string | null
    category_slug?: string | null
    notes?: string | null
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  const referenceId = body.referenceId?.trim()
  if (!referenceId) {
    return NextResponse.json({ error: 'referenceId required' }, { status: 400 })
  }
  const mode =
    body.mode === undefined
      ? undefined
      : body.mode === null
        ? null
        : VALID_MODES.has(body.mode)
          ? (body.mode as PostReferenceMode)
          : null
  const role =
    body.role === undefined
      ? undefined
      : body.role === null
        ? null
        : VALID_ROLES.has(body.role)
          ? (body.role as PostReferenceRole)
          : null
  try {
    const reference = await updatePostReferenceMeta(referenceId, {
      label: body.label,
      mode,
      role,
      category_slug: body.category_slug,
      notes: body.notes,
    })
    return NextResponse.json({ reference })
  } catch (e) {
    const msg = errorMessage(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'admin only' }, { status: 403 })
  }
  const url = new URL(req.url)
  const referenceId = url.searchParams.get('referenceId')
  if (!referenceId) {
    return NextResponse.json({ error: 'referenceId required' }, { status: 400 })
  }
  try {
    await deletePostReference(referenceId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = errorMessage(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
