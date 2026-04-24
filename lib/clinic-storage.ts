// Browser-side backup of the doctor access token.
// Used as a safety net for iOS PWA cookie-jar isolation:
// when the home-screen PWA launches without the cookie that
// was set in Safari, we restore the session from localStorage
// via /api/auth/restore.

const KEY = 'cm.token'

export function setStoredToken(token: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY, token)
  } catch {
    // storage unavailable (private mode, quota) — silently ignore
  }
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function clearStoredToken(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
