import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import {
  createAccessToken,
  listActiveTokensForClinic,
  revokeToken,
  setAccessCode,
  validateCode,
} from '@/lib/auth/tokens'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }

  let body: {
    clinicId?: string
    revokeExisting?: boolean
    doctorName?: string
    role?: string
    code?: string
  }
  try {
    body = (await req.json()) as {
      clinicId?: string
      revokeExisting?: boolean
      doctorName?: string
      role?: string
      code?: string
    }
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const clinicId = body.clinicId?.trim()
  if (!clinicId) {
    return NextResponse.json({ error: 'clinicId required' }, { status: 400 })
  }

  const doctorName = body.doctorName?.trim() || undefined
  const role: 'doctor' | 'editor' =
    body.role === 'editor' ? 'editor' : 'doctor'

  let code: string | null = null
  if (typeof body.code === 'string' && body.code.trim().length > 0) {
    const result = validateCode(body.code)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    code = result.code
  }

  if (body.revokeExisting) {
    const existing = await listActiveTokensForClinic(clinicId)
    await Promise.all(
      existing
        .filter((t) => t.role === role)
        .map((t) => revokeToken(t.token))
    )
  }

  try {
    const row = await createAccessToken({
      clinicId,
      role,
      label: doctorName,
      code,
    })
    const url = new URL(req.url)
    const installUrl = `${url.origin}/c/${row.token}`

    return NextResponse.json({
      token: row.token,
      url: installUrl,
      role: row.role,
      doctorName: row.label,
      code: row.code,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('duplicate') || msg.includes('unique')) {
      return NextResponse.json(
        { error: `Code "${code}" is already in use. Pick another.` },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// Update the memorable code on an existing token without revoking it.
// Body: { token: string, code: string | null }. Null clears the code.
export async function PATCH(req: Request) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }

  let body: { token?: string; code?: string | null }
  try {
    body = (await req.json()) as { token?: string; code?: string | null }
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const token = body.token?.trim()
  if (!token) {
    return NextResponse.json({ error: 'token required' }, { status: 400 })
  }

  let nextCode: string | null = null
  if (typeof body.code === 'string' && body.code.trim().length > 0) {
    const result = validateCode(body.code)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    nextCode = result.code
  }

  try {
    const row = await setAccessCode(token, nextCode)
    if (!row) {
      return NextResponse.json({ error: 'token not found' }, { status: 404 })
    }
    return NextResponse.json({
      token: row.token,
      role: row.role,
      doctorName: row.label,
      code: row.code,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('duplicate') || msg.includes('unique')) {
      return NextResponse.json(
        { error: `Code "${nextCode}" is already in use. Pick another.` },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: Request) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }

  const url = new URL(req.url)
  const clinicId = url.searchParams.get('clinicId')
  if (!clinicId) {
    return NextResponse.json({ error: 'clinicId required' }, { status: 400 })
  }

  const tokens = await listActiveTokensForClinic(clinicId)
  const links = tokens.map((t) => ({
    token: t.token,
    url: `${url.origin}/c/${t.token}`,
    role: t.role,
    doctorName: t.label,
    code: t.code,
    lastUsedAt: t.last_used_at,
  }))
  return NextResponse.json({ links })
}
