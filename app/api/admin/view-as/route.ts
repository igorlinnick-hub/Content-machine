import { NextResponse } from 'next/server'
import {
  clearViewAsCookie,
  resolveAccess,
  setViewAsCookie,
} from '@/lib/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Admin toggles the "view as doctor" preview. Requires the admin
// cookie to be present — a doctor hitting this endpoint can never
// upgrade their own role. Body: { clinicId } to enter preview, {} to
// exit. Always re-checks resolveAccess() so a previewing admin who
// hits this again can still exit.

interface Body {
  clinicId?: string | null
  // explicit exit flag for clarity from the client; falsy clinicId
  // also clears
  exit?: boolean
}

async function isAdminCookiePresent(): Promise<boolean> {
  // Re-resolve. While previewing, resolveAccess returns DoctorAccess
  // with adminPreview=true — we treat that as still-admin for the
  // purpose of toggling preview off again.
  const access = await resolveAccess()
  if (!access) return false
  if (access.role === 'admin') return true
  return access.role === 'doctor' && access.adminPreview === true
}

export async function POST(req: Request) {
  if (!(await isAdminCookiePresent())) {
    return NextResponse.json(
      { error: 'admin access required' },
      { status: 403 }
    )
  }
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    body = {}
  }
  if (body.exit || !body.clinicId) {
    clearViewAsCookie()
    return NextResponse.json({ ok: true, preview: false })
  }
  setViewAsCookie(body.clinicId.trim())
  return NextResponse.json({ ok: true, preview: true, clinicId: body.clinicId })
}
