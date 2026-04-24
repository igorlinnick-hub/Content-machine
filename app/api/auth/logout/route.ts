import { NextResponse } from 'next/server'
import { COOKIE_TOKEN, COOKIE_ADMIN } from '@/lib/auth/session'

export const runtime = 'nodejs'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_TOKEN, '', { path: '/', maxAge: 0 })
  res.cookies.set(COOKIE_ADMIN, '', { path: '/', maxAge: 0 })
  return res
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const res = NextResponse.redirect(new URL('/', url.origin))
  res.cookies.set(COOKIE_TOKEN, '', { path: '/', maxAge: 0 })
  res.cookies.set(COOKIE_ADMIN, '', { path: '/', maxAge: 0 })
  return res
}
