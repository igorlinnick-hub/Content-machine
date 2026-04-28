import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import {
  clearClinicLogo,
  getClinicLogo,
  uploadClinicLogo,
} from '@/lib/clinics/brand'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BYTES = 2 * 1024 * 1024 // 2 MB

const ALLOWED_TYPES = new Set<string>([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
])

function extFromContentType(ct: string): string {
  switch (ct) {
    case 'image/png':
      return 'png'
    case 'image/jpeg':
      return 'jpg'
    case 'image/webp':
      return 'webp'
    case 'image/svg+xml':
      return 'svg'
    default:
      return 'bin'
  }
}

async function requireAdmin() {
  const access = await resolveAccess()
  return access && access.role === 'admin' ? access : null
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
    const logoUrl = await getClinicLogo(clinicId)
    return NextResponse.json({ logoUrl })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
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
    return NextResponse.json({ error: 'expected multipart/form-data' }, { status: 400 })
  }

  const clinicId = String(form.get('clinicId') ?? '').trim()
  const file = form.get('file')

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
      { error: 'file too large (max 2 MB)' },
      { status: 413 }
    )
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `unsupported type ${file.type || 'unknown'}` },
      { status: 415 }
    )
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const logoUrl = await uploadClinicLogo(clinicId, {
      bytes,
      contentType: file.type,
      ext: extFromContentType(file.type),
    })
    return NextResponse.json({ logoUrl })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'admin only' }, { status: 403 })
  }
  const url = new URL(req.url)
  const clinicId = url.searchParams.get('clinicId')
  if (!clinicId) {
    return NextResponse.json({ error: 'clinicId required' }, { status: 400 })
  }
  try {
    await clearClinicLogo(clinicId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
