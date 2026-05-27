import { cookies } from 'next/headers'
import { lookupActiveToken, touchToken } from './tokens'
import { createServerClient } from '@/lib/supabase/server'

export const COOKIE_TOKEN = 'cm_token'
export const COOKIE_ADMIN = 'cm_admin'
// "View as doctor" override — set by admin via /api/admin/view-as.
// Value = clinic_id the admin wants to preview as. Only honoured if
// the admin cookie is also valid, so a doctor cannot ever lift their
// own role.
export const COOKIE_VIEW_AS = 'cm_view_as'

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

export interface DoctorAccess {
  role: 'doctor' | 'editor'
  clinicId: string
  token: string
  doctorName: string | null
  firstVisit: boolean
  // True when this is actually an admin previewing the doctor view.
  // Pages can use this to render the "Exit preview" banner without
  // changing any of their gating logic — the access still looks
  // doctor-shaped to everything downstream.
  adminPreview?: boolean
}

export interface AdminAccess {
  role: 'admin'
}

export type Access = DoctorAccess | AdminAccess

function isProd(): boolean {
  return process.env.NODE_ENV === 'production'
}

function adminKey(): string | null {
  const v = process.env.ADMIN_KEY?.trim()
  return v && v.length > 0 ? v : null
}

export async function resolveAccess(): Promise<Access | null> {
  const jar = cookies()
  const adminCookie = jar.get(COOKIE_ADMIN)?.value
  const expectedAdmin = adminKey()
  const isAdmin =
    !!expectedAdmin && !!adminCookie && adminCookie === expectedAdmin

  if (isAdmin) {
    // Admin "view as doctor" preview — only valid when admin cookie
    // is present. Doctors hitting this cookie value get no special
    // treatment (the check above already returned them through the
    // token path on the next branch).
    const viewAsClinicId = jar.get(COOKIE_VIEW_AS)?.value
    if (viewAsClinicId) {
      const preview = await loadPreviewAccess(viewAsClinicId)
      if (preview) return preview
      // Stale cookie pointing at a deleted clinic — fall through to
      // normal admin so the operator still sees something usable.
    }
    return { role: 'admin' }
  }

  const tokenCookie = jar.get(COOKIE_TOKEN)?.value
  if (tokenCookie) {
    const row = await lookupActiveToken(tokenCookie)
    if (row) {
      const firstVisit = row.last_used_at === null
      // fire-and-forget; we don't block the page render
      void touchToken(tokenCookie)
      return {
        role: row.role,
        clinicId: row.clinic_id,
        token: tokenCookie,
        doctorName: row.label,
        firstVisit,
      }
    }
  }
  return null
}

export function setDoctorCookie(token: string): void {
  cookies().set(COOKIE_TOKEN, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd(),
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
  })
}

export function setAdminCookie(key: string): void {
  cookies().set(COOKIE_ADMIN, key, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd(),
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
  })
}

export function clearDoctorCookie(): void {
  cookies().delete(COOKIE_TOKEN)
}

export function clearAdminCookie(): void {
  cookies().delete(COOKIE_ADMIN)
}

export function isAdminKeyValid(key: string): boolean {
  const expected = adminKey()
  return !!expected && key === expected
}

export function setViewAsCookie(clinicId: string): void {
  cookies().set(COOKIE_VIEW_AS, clinicId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd(),
    path: '/',
    // Short — preview should NOT persist forever; admin re-enables
    // explicitly each session.
    maxAge: 60 * 60 * 8,
  })
}

export function clearViewAsCookie(): void {
  cookies().delete(COOKIE_VIEW_AS)
}

// Used by resolveAccess() when admin has cm_view_as set. We synthesize
// a doctor-shaped Access for the targeted clinic so every downstream
// page (which gates on role === 'admin') renders the doctor surface
// without any branching. Token is a sentinel — DB writes that need
// a real token will still see role === 'doctor' but token === '__preview__'
// and can short-circuit on that if needed.
async function loadPreviewAccess(
  clinicId: string
): Promise<DoctorAccess | null> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('clinics')
    .select('id, doctor_name')
    .eq('id', clinicId)
    .maybeSingle()
  if (!data) return null
  return {
    role: 'doctor',
    clinicId: data.id,
    token: '__preview__',
    doctorName: data.doctor_name ?? null,
    firstVisit: false,
    adminPreview: true,
  }
}
