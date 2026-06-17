import { NextResponse } from 'next/server'
import { lookupByCodeOrToken, touchToken } from '@/lib/auth/tokens'
import { COOKIE_TOKEN } from '@/lib/auth/session'
import { clearAttempts, ipFromRequest, recordAttempt } from '@/lib/auth/rate-limit'

export const runtime = 'nodejs'

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

export async function POST(req: Request) {
  let input = ''
  try {
    const body = (await req.json()) as { token?: unknown; code?: unknown }
    // Either field accepted — the lookup tries token, URL prefix, then code.
    const raw =
      typeof body.token === 'string'
        ? body.token
        : typeof body.code === 'string'
          ? body.code
          : ''
    input = raw.trim()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  if (!input) {
    return NextResponse.json({ error: 'code or token required' }, { status: 400 })
  }

  const ip = ipFromRequest(req)
  const decision = recordAttempt(ip)
  if (!decision.allowed) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${decision.retryAfterSeconds}s.` },
      { status: 429 }
    )
  }

  const row = await lookupByCodeOrToken(input)
  if (!row) {
    return NextResponse.json({ error: 'invalid code' }, { status: 401 })
  }

  // Successful login clears the IP bucket so a legitimate user who
  // mistyped a few times doesn't stay throttled.
  clearAttempts(ip)
  void touchToken(row.token)

  const res = NextResponse.json({ ok: true, clinicId: row.clinic_id })
  res.cookies.set(COOKIE_TOKEN, row.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
  })
  return res
}
