import { NextResponse } from 'next/server'
import { COOKIE_ADMIN, isAdminKeyValid } from '@/lib/auth/session'

export const runtime = 'nodejs'

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

export async function POST(req: Request) {
  let body: { key?: unknown }
  try {
    body = (await req.json()) as { key?: unknown }
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  const key = typeof body.key === 'string' ? body.key.trim() : ''
  if (!key || !isAdminKeyValid(key)) {
    return NextResponse.json({ error: 'invalid key' }, { status: 401 })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_ADMIN, key, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
  })
  return res
}
