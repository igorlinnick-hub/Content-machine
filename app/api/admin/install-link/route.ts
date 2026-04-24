import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import {
  createAccessToken,
  listActiveTokensForClinic,
  revokeToken,
} from '@/lib/auth/tokens'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }

  let body: { clinicId?: string; revokeExisting?: boolean }
  try {
    body = (await req.json()) as { clinicId?: string; revokeExisting?: boolean }
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const clinicId = body.clinicId?.trim()
  if (!clinicId) {
    return NextResponse.json({ error: 'clinicId required' }, { status: 400 })
  }

  if (body.revokeExisting) {
    const existing = await listActiveTokensForClinic(clinicId)
    await Promise.all(
      existing
        .filter((t) => t.role === 'doctor')
        .map((t) => revokeToken(t.token))
    )
  }

  const row = await createAccessToken({ clinicId, role: 'doctor' })
  const url = new URL(req.url)
  const installUrl = `${url.origin}/c/${row.token}`

  return NextResponse.json({ token: row.token, url: installUrl })
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
  const links = tokens
    .filter((t) => t.role === 'doctor')
    .map((t) => ({
      token: t.token,
      url: `${url.origin}/c/${t.token}`,
    }))
  return NextResponse.json({ links })
}
