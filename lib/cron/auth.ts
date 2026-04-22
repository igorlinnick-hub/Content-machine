import { NextResponse } from 'next/server'

// Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
// Supabase pg_net / Supabase Cron can be configured to send the same header.
// If CRON_SECRET is not set (dev), requests are allowed through.
export function checkCronAuth(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET
  if (!secret) return null

  const auth = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  if (auth !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return null
}
