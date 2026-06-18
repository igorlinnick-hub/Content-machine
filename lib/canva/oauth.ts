// Canva Connect OAuth2 — token cache + auto-refresh.
//
// The marketer authenticated the HWC Canva workspace once (out-of-
// band, in the parallel Canva chat). We store the resulting refresh
// token in Vercel env vars:
//   CANVA_CLIENT_ID
//   CANVA_CLIENT_SECRET
//   CANVA_REFRESH_TOKEN
//   CANVA_ACCESS_TOKEN      (optional — bootstrap value, expires ~4h)
//   CANVA_TOKEN_EXPIRES     (optional — ISO timestamp)
//
// We never call the OAuth flow at runtime — only refresh. If the
// refresh token itself expires (~90 days idle), the operator re-auths
// in the canva_connect.py CLI and updates env vars.
//
// In-memory cache: the access token is fine to reuse across requests
// within a single serverless instance. We refresh when <60s left.

interface CachedToken {
  accessToken: string
  expiresAt: number // epoch ms
}

let cache: CachedToken | null = null

const CANVA_API = 'https://api.canva.com/rest/v1'
const TOKEN_URL = `${CANVA_API}/oauth/token`

function env(name: string): string | null {
  const v = process.env[name]
  return v && v.trim().length > 0 ? v.trim() : null
}

export class CanvaAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CanvaAuthError'
  }
}

// True when all required env vars are present. Compose endpoint
// checks this before attempting a real call, so missing config
// falls back to queue-only behaviour with a clear error.
export function canvaIsConfigured(): boolean {
  return (
    !!env('CANVA_CLIENT_ID') &&
    !!env('CANVA_CLIENT_SECRET') &&
    !!env('CANVA_REFRESH_TOKEN')
  )
}

export async function getCanvaAccessToken(): Promise<string> {
  if (!canvaIsConfigured()) {
    throw new CanvaAuthError(
      'Canva is not configured. Set CANVA_CLIENT_ID, CANVA_CLIENT_SECRET, CANVA_REFRESH_TOKEN in Vercel env.'
    )
  }

  const now = Date.now()
  if (cache && cache.expiresAt - now > 60_000) {
    return cache.accessToken
  }

  // Optional bootstrap path: if the operator just rotated tokens in
  // env, prefer the fresh CANVA_ACCESS_TOKEN until its declared expiry.
  const bootstrapToken = env('CANVA_ACCESS_TOKEN')
  const bootstrapExpires = env('CANVA_TOKEN_EXPIRES')
  if (bootstrapToken && bootstrapExpires) {
    const exp = Date.parse(bootstrapExpires)
    if (Number.isFinite(exp) && exp - now > 60_000) {
      cache = { accessToken: bootstrapToken, expiresAt: exp }
      return bootstrapToken
    }
  }

  // Standard refresh flow — RFC 6749 grant_type=refresh_token, but
  // Canva expects HTTP Basic auth with client_id:client_secret on the
  // token endpoint (NOT the body, per their docs).
  const clientId = env('CANVA_CLIENT_ID')!
  const clientSecret = env('CANVA_CLIENT_SECRET')!
  const refreshToken = env('CANVA_REFRESH_TOKEN')!

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      authorization: `Basic ${basic}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new CanvaAuthError(
      `Canva token refresh ${res.status}: ${text.slice(0, 400)}`
    )
  }

  const body = (await res.json()) as {
    access_token?: string
    expires_in?: number
    token_type?: string
  }
  if (!body.access_token) {
    throw new CanvaAuthError('Canva token refresh returned no access_token')
  }

  const expiresIn = typeof body.expires_in === 'number' ? body.expires_in : 14400
  cache = {
    accessToken: body.access_token,
    expiresAt: now + expiresIn * 1000,
  }
  return body.access_token
}

// Common header builder for every authed Canva call. 401 from a
// downstream call should clear the cache so the next call re-refreshes.
export function clearCanvaCache(): void {
  cache = null
}

export { CANVA_API }
