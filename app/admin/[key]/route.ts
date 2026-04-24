import { NextResponse } from 'next/server'
import { COOKIE_ADMIN, isAdminKeyValid } from '@/lib/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

export async function GET(
  req: Request,
  { params }: { params: { key: string } }
) {
  const url = new URL(req.url)
  if (!isAdminKeyValid(params.key)) {
    return NextResponse.redirect(new URL('/?error=invalid_admin', url.origin))
  }

  const res = NextResponse.redirect(new URL('/dashboard', url.origin))
  res.cookies.set(COOKIE_ADMIN, params.key, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
  })
  return res
}
