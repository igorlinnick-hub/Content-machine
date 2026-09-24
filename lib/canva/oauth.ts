// Canva Connect OAuth2 — token store + auto-refresh.
//
// The marketer authenticated the HWC Canva workspace once (out-of-
// band, in the parallel Canva chat). Env vars:
//   CANVA_CLIENT_ID
//   CANVA_CLIENT_SECRET
//   CANVA_REFRESH_TOKEN     (SEED only — see below)
//   CANVA_ACCESS_TOKEN      (optional — bootstrap value, expires ~4h)
//   CANVA_TOKEN_EXPIRES     (optional — ISO timestamp)
//
// ⚠️ REFRESH TOKENS ROTATE AND ARE SINGLE-USE.
// Canva's docs are explicit: "A successful response from the endpoint
// includes a new access token, the expiry time for the new token, and
// another refresh token" / "Each refresh token can only be used once."
// This module used to drop that returned refresh_token on the floor,
// which meant CANVA_REFRESH_TOKEN in Vercel was dead after the FIRST
// exchange and everything 401'd until a human re-authed.
//
// Vercel env vars are read-only at runtime, so the live token lives in
// Supabase (`canva_oauth_tokens`, migration 055) and CANVA_REFRESH_TOKEN
// is only the seed used to populate that row on a cold install.
//
// If migration 055 has not been applied the store is unavailable; we
// degrade to the old env-only behaviour and log loudly, because in that
// mode the token chain breaks again after one refresh.
//
// In-memory cache: the access token is fine to reuse across requests
// within a single serverless instance. We refresh when <60s left.

import { createClient } from '@supabase/supabase-js'

interface CachedToken {
  accessToken: string
  expiresAt: number // epoch ms
}

let cache: CachedToken | null = null
// Set by clearCanvaCache() after a downstream 401. Forces the next call
// past BOTH the memory cache and the stored access token, otherwise the
// retry just replays the same stale token.
let forceRefresh = false

const CANVA_API = 'https://api.canva.com/rest/v1'
const TOKEN_URL = `${CANVA_API}/oauth/token`
const TOKEN_ROW_ID = 'default'
const SKEW_MS = 60_000

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
// CANVA_REFRESH_TOKEN stays required: it is the seed a cold install
// needs before the Supabase row exists.
export function canvaIsConfigured(): boolean {
  return (
    !!env('CANVA_CLIENT_ID') &&
    !!env('CANVA_CLIENT_SECRET') &&
    !!env('CANVA_REFRESH_TOKEN')
  )
}

// ── token store (Supabase) ──────────────────────────────────────

interface StoredTokens {
  refreshToken: string
  accessToken: string | null
  accessExpiresAt: number | null // epoch ms
}

// Untyped on purpose — `canva_oauth_tokens` is not in the generated
// Database type, and regenerating types is not worth coupling here.
function tokenStore() {
  const url = env('NEXT_PUBLIC_SUPABASE_URL')
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function readStored(): Promise<StoredTokens | null> {
  const db = tokenStore()
  if (!db) return null
  const { data, error } = await db
    .from('canva_oauth_tokens')
    .select('refresh_token, access_token, access_expires_at')
    .eq('id', TOKEN_ROW_ID)
    .maybeSingle()
  if (error) {
    console.warn(
      `[canva-oauth] token store unreadable (migration 055 applied?): ${error.message}`
    )
    return null
  }
  if (!data?.refresh_token) return null
  const exp = data.access_expires_at ? Date.parse(data.access_expires_at) : NaN
  return {
    refreshToken: data.refresh_token as string,
    accessToken: (data.access_token as string | null) ?? null,
    accessExpiresAt: Number.isFinite(exp) ? exp : null,
  }
}

async function persistStored(next: {
  refreshToken: string
  accessToken: string
  expiresAt: number
}): Promise<void> {
  const db = tokenStore()
  if (!db) {
    console.error(
      '[canva-oauth] no Supabase creds — the rotated refresh token was NOT saved. ' +
        'The next refresh will fail; re-auth will be needed.'
    )
    return
  }
  const { error } = await db.from('canva_oauth_tokens').upsert(
    {
      id: TOKEN_ROW_ID,
      refresh_token: next.refreshToken,
      access_token: next.accessToken,
      access_expires_at: new Date(next.expiresAt).toISOString(),
      rotated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  )
  if (error) {
    // This is the dangerous case: Canva already invalidated the old
    // token, and we failed to record the new one. Say so in the logs —
    // the symptom otherwise shows up hours later as a blanket 401.
    console.error(
      `[canva-oauth] ROTATED TOKEN LOST — upsert failed: ${error.message}. ` +
        'Apply migration 055 and re-auth the Canva workspace.'
    )
  }
}

// ── refresh ─────────────────────────────────────────────────────

type ExchangeResult =
  | { ok: true; accessToken: string; refreshToken: string | null; expiresIn: number }
  | { ok: false; status: number; body: string }

async function exchange(refreshToken: string): Promise<ExchangeResult> {
  // Canva expects HTTP Basic auth with client_id:client_secret on the
  // token endpoint (NOT in the body, per their docs).
  const basic = Buffer.from(
    `${env('CANVA_CLIENT_ID')!}:${env('CANVA_CLIENT_SECRET')!}`
  ).toString('base64')

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
    const body = await res.text().catch(() => '')
    return { ok: false, status: res.status, body: body.slice(0, 400) }
  }

  const parsed = (await res.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    token_type?: string
  }
  if (!parsed.access_token) {
    return { ok: false, status: res.status, body: 'no access_token in response' }
  }
  return {
    ok: true,
    accessToken: parsed.access_token,
    refreshToken: parsed.refresh_token ?? null,
    expiresIn: typeof parsed.expires_in === 'number' ? parsed.expires_in : 14400,
  }
}

export async function getCanvaAccessToken(): Promise<string> {
  if (!canvaIsConfigured()) {
    throw new CanvaAuthError(
      'Canva is not configured. Set CANVA_CLIENT_ID, CANVA_CLIENT_SECRET, CANVA_REFRESH_TOKEN in Vercel env.'
    )
  }

  const forced = forceRefresh
  forceRefresh = false

  const now = Date.now()
  if (!forced && cache && cache.expiresAt - now > SKEW_MS) {
    return cache.accessToken
  }

  const stored = await readStored()

  // A stored access token that is still valid beats burning a
  // single-use refresh token just because this lambda is cold.
  if (
    !forced &&
    stored?.accessToken &&
    stored.accessExpiresAt &&
    stored.accessExpiresAt - now > SKEW_MS
  ) {
    cache = { accessToken: stored.accessToken, expiresAt: stored.accessExpiresAt }
    return stored.accessToken
  }

  // Bootstrap path — only before the first rotation, while the store is
  // still empty. Once a row exists, env values are stale by definition.
  if (!forced && !stored) {
    const bootstrapToken = env('CANVA_ACCESS_TOKEN')
    const bootstrapExpires = env('CANVA_TOKEN_EXPIRES')
    if (bootstrapToken && bootstrapExpires) {
      const exp = Date.parse(bootstrapExpires)
      if (Number.isFinite(exp) && exp - now > SKEW_MS) {
        cache = { accessToken: bootstrapToken, expiresAt: exp }
        return bootstrapToken
      }
    }
  }

  const seed = stored?.refreshToken ?? env('CANVA_REFRESH_TOKEN')!
  let result = await exchange(seed)

  // A concurrent instance may have rotated the token between our read
  // and our POST — its winner is now in the store. Retry once with it.
  if (!result.ok) {
    const fresh = await readStored()
    if (fresh && fresh.refreshToken !== seed) {
      result = await exchange(fresh.refreshToken)
    }
  }

  if (!result.ok) {
    throw new CanvaAuthError(
      `Canva token refresh ${result.status}: ${result.body}. ` +
        'Refresh tokens are single-use — if this persists, re-auth the Canva ' +
        'workspace and seed canva_oauth_tokens (or CANVA_REFRESH_TOKEN) with the new token.'
    )
  }

  const expiresAt = Date.now() + result.expiresIn * 1000
  // Keep the old refresh token only if Canva sent none back (it always
  // should); losing it is what broke this module in the first place.
  await persistStored({
    refreshToken: result.refreshToken ?? seed,
    accessToken: result.accessToken,
    expiresAt,
  })

  cache = { accessToken: result.accessToken, expiresAt }
  return result.accessToken
}

// Common header builder for every authed Canva call. 401 from a
// downstream call should clear the cache so the next call re-refreshes —
// including the copy cached in Supabase.
export function clearCanvaCache(): void {
  cache = null
  forceRefresh = true
}

export { CANVA_API }
