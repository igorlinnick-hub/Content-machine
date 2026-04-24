import { cookies } from 'next/headers'
import { lookupActiveToken, touchToken } from './tokens'

export const COOKIE_TOKEN = 'cm_token'
export const COOKIE_ADMIN = 'cm_admin'

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

export interface DoctorAccess {
  role: 'doctor' | 'editor'
  clinicId: string
  token: string
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
  if (expectedAdmin && adminCookie && adminCookie === expectedAdmin) {
    return { role: 'admin' }
  }

  const tokenCookie = jar.get(COOKIE_TOKEN)?.value
  if (tokenCookie) {
    const row = await lookupActiveToken(tokenCookie)
    if (row) {
      // fire-and-forget; we don't block the page render
      void touchToken(tokenCookie)
      return {
        role: row.role,
        clinicId: row.clinic_id,
        token: tokenCookie,
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
