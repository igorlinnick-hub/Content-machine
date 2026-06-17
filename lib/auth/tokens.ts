import { randomBytes } from 'crypto'
import { createServerClient } from '@/lib/supabase/server'

const TOKEN_BYTES = 18 // 24 url-safe chars

export function generateTokenString(): string {
  return randomBytes(TOKEN_BYTES)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

export interface AccessTokenRow {
  token: string
  clinic_id: string
  role: 'doctor' | 'editor'
  label: string | null
  code: string | null
  revoked_at: string | null
  last_used_at: string | null
}

// Memorable codes that the admin sets on a token so the doctor / team
// can sign in by typing instead of opening a URL. Stored lowercased.
const CODE_PATTERN = /^[A-Za-z0-9_-]{3,32}$/

export function normalizeCode(input: string): string {
  return input.trim().toLowerCase()
}

export function validateCode(input: string): { ok: true; code: string } | { ok: false; error: string } {
  const trimmed = input.trim()
  if (trimmed.length === 0) return { ok: false, error: 'Code is required' }
  if (!CODE_PATTERN.test(trimmed)) {
    return {
      ok: false,
      error: 'Code must be 3-32 chars, letters/digits/dash/underscore only',
    }
  }
  return { ok: true, code: normalizeCode(trimmed) }
}

export async function createAccessToken(params: {
  clinicId: string
  role?: 'doctor' | 'editor'
  label?: string
  code?: string | null
}): Promise<AccessTokenRow> {
  const supabase = createServerClient()
  const token = generateTokenString()
  const code = params.code ? normalizeCode(params.code) : null
  const { data, error } = await supabase
    .from('clinic_access_tokens')
    .insert({
      token,
      clinic_id: params.clinicId,
      role: params.role ?? 'doctor',
      label: params.label ?? null,
      code,
    })
    .select('token, clinic_id, role, label, code, revoked_at, last_used_at')
    .single()
  if (error || !data) throw error ?? new Error('createAccessToken: no row returned')
  return data as AccessTokenRow
}

// Update the code on an existing active token. Used by admin to add or
// rotate a memorable code without revoking the underlying token (so
// existing /c/<token> links keep working).
export async function setAccessCode(
  token: string,
  code: string | null
): Promise<AccessTokenRow | null> {
  const supabase = createServerClient()
  const normalized = code ? normalizeCode(code) : null
  const { data, error } = await supabase
    .from('clinic_access_tokens')
    .update({ code: normalized })
    .eq('token', token)
    .is('revoked_at', null)
    .select('token, clinic_id, role, label, code, revoked_at, last_used_at')
    .maybeSingle()
  if (error) throw error
  return (data as AccessTokenRow | null) ?? null
}

export async function lookupActiveToken(
  token: string
): Promise<AccessTokenRow | null> {
  if (!token) return null
  const supabase = createServerClient()
  const { data } = await supabase
    .from('clinic_access_tokens')
    .select('token, clinic_id, role, label, code, revoked_at, last_used_at')
    .eq('token', token)
    .is('revoked_at', null)
    .maybeSingle()
  return (data as AccessTokenRow | null) ?? null
}

// Resolves whatever the user typed into the login box. Tries:
//   1. As a /c/<token> URL fragment (strip prefix).
//   2. As a raw token (24-char random).
//   3. As a memorable code (lowercased).
// Returns the active row or null. No timing-attack hardening on
// purpose — codes are random enough and the per-IP rate limit
// upstream is the real defence.
export async function lookupByCodeOrToken(
  input: string
): Promise<AccessTokenRow | null> {
  const raw = input.trim()
  if (!raw) return null

  // Strip /c/<token> URL prefix if present.
  const stripped = raw.includes('/c/')
    ? raw.split('/c/').pop()?.split(/[?#]/)[0] ?? raw
    : raw

  const candidate = stripped.trim()
  if (!candidate) return null

  // Try as a raw token first — 24 base64url chars from generateTokenString.
  const tokenHit = await lookupActiveToken(candidate)
  if (tokenHit) return tokenHit

  // Fall back to code lookup — case-insensitive, unique among active rows.
  const supabase = createServerClient()
  const { data } = await supabase
    .from('clinic_access_tokens')
    .select('token, clinic_id, role, label, code, revoked_at, last_used_at')
    .eq('code', normalizeCode(candidate))
    .is('revoked_at', null)
    .maybeSingle()
  return (data as AccessTokenRow | null) ?? null
}

export async function touchToken(token: string): Promise<void> {
  const supabase = createServerClient()
  await supabase
    .from('clinic_access_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('token', token)
}

export async function revokeToken(token: string): Promise<void> {
  const supabase = createServerClient()
  await supabase
    .from('clinic_access_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('token', token)
}

export async function listActiveTokensForClinic(
  clinicId: string
): Promise<AccessTokenRow[]> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('clinic_access_tokens')
    .select('token, clinic_id, role, label, code, revoked_at, last_used_at')
    .eq('clinic_id', clinicId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
  return (data as AccessTokenRow[] | null) ?? []
}
