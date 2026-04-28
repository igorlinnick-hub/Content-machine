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
  revoked_at: string | null
  last_used_at: string | null
}

export async function createAccessToken(params: {
  clinicId: string
  role?: 'doctor' | 'editor'
  label?: string
}): Promise<AccessTokenRow> {
  const supabase = createServerClient()
  const token = generateTokenString()
  const { data, error } = await supabase
    .from('clinic_access_tokens')
    .insert({
      token,
      clinic_id: params.clinicId,
      role: params.role ?? 'doctor',
      label: params.label ?? null,
    })
    .select('token, clinic_id, role, label, revoked_at, last_used_at')
    .single()
  if (error || !data) throw error ?? new Error('createAccessToken: no row returned')
  return data as AccessTokenRow
}

export async function lookupActiveToken(
  token: string
): Promise<AccessTokenRow | null> {
  if (!token) return null
  const supabase = createServerClient()
  const { data } = await supabase
    .from('clinic_access_tokens')
    .select('token, clinic_id, role, label, revoked_at, last_used_at')
    .eq('token', token)
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
    .select('token, clinic_id, role, label, revoked_at, last_used_at')
    .eq('clinic_id', clinicId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
  return (data as AccessTokenRow[] | null) ?? []
}
