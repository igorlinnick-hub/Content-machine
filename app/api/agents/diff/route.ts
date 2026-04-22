import { NextResponse } from 'next/server'
import { checkCronAuth } from '@/lib/cron/auth'

export const runtime = 'nodejs'
export const maxDuration = 300

// The diff agent learns from human edits on shipped scripts. Originally
// it pulled edits from Google Docs; with the Docs export removed, it
// needs a paste-back path (user submits their edited version via a UI
// form) before it has anything to diff. Keeping the route + cron so the
// wiring stays alive, but it's a no-op until that path lands.
export async function POST(req: Request) {
  const unauth = checkCronAuth(req)
  if (unauth) return unauth
  return NextResponse.json({
    processed: 0,
    note: 'paste-back UI pending — diff agent dormant',
  })
}

export async function GET(req: Request) {
  return POST(req)
}
