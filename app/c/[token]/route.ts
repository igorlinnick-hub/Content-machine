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

  const firstVisit = row.last_used_at === null
  void touchToken(token)

  // First-visit doctors land on a personalized welcome that walks them
  // through the setup quiz themselves. Returning doctors go straight to
  // the dashboard. Either way we attach cm_bootstrap so the localStorage
  // backup picks it up client-side (cookie may not flow into PWA on
  // iOS < 16.4).
  const redirectUrl = new URL(
    firstVisit ? '/onboarding' : '/dashboard',
    url.origin
  )
  if (firstVisit) redirectUrl.searchParams.set('welcome', '1')
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
