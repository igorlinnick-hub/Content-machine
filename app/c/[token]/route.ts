import { NextResponse } from 'next/server'
import { lookupActiveToken, touchToken } from '@/lib/auth/tokens'
import { COOKIE_TOKEN } from '@/lib/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

export async function GET(
  req: Request,
  { params }: { params: { token: string } }
) {
  const token = params.token
  const url = new URL(req.url)

  const row = await lookupActiveToken(token)
  if (!row) {
    return NextResponse.redirect(new URL('/?error=invalid_link', url.origin))
  }

  void touchToken(token)

  // Redirect to dashboard with token bootstrap so localStorage backup
  // can pick it up client-side (cookie may not flow into PWA on iOS < 16.4).
  const redirectUrl = new URL('/dashboard', url.origin)
  redirectUrl.searchParams.set('cm_bootstrap', token)

  const res = NextResponse.redirect(redirectUrl)
  res.cookies.set(COOKIE_TOKEN, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
  })
  return res
}
