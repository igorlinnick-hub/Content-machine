import { NextResponse } from 'next/server'

// Which build is currently being served. The installed PWA polls this and
// silently reloads itself when the answer changes, so a doctor never has to
// pull-to-refresh (or worse, reinstall) to get a fix we shipped.
//
// VERCEL_GIT_COMMIT_SHA is injected per deployment; locally it's absent, so
// the value stays 'dev' and the watcher never triggers.

export const dynamic = 'force-dynamic'
export const revalidate = 0

export function GET() {
  const v =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    'dev'

  return NextResponse.json(
    { v },
    { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } }
  )
}
