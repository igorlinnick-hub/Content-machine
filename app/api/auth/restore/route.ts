import { NextResponse } from 'next/server'
import { lookupActiveToken, touchToken } from '@/lib/auth/tokens'
import { COOKIE_TOKEN } from '@/lib/auth/session'

export const runtime = 'nodejs'

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

export async function POST(req: Request) {
  let token = ''
  try {
    const body = (await req.json()) as { token?: unknown }
    if (typeof body.token === 'string') token = body.token.trim()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  if (!token) {
    return NextResponse.json({ error: 'token required' }, { status: 400 })
  }

  const row = await lookupActiveToken(token)
  if (!row) {
    return NextResponse.json({ error: 'invalid token' }, { status: 401 })
  }

  void touchToken(token)

  const res = NextResponse.json({ ok: true, clinicId: row.clinic_id })
  res.cookies.set(COOKIE_TOKEN, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
  })
  return res
}
