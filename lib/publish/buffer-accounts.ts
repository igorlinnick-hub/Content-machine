import { createServerClient } from '@/lib/supabase/server'

// Which Buffer account and which channels a brand publishes to.
//
// Keyed by `clinics.niche`, like lib/niche/profiles.ts. Brands live in
// different Buffer accounts, so each entry names the env var holding ITS
// token — one global BUFFER_TOKEN would post every brand into the same feed.
//
// A niche with no entry cannot publish at all. That is how the clinics are
// switched off (Igor 2026-09-28): regenmed / aesthetics have no entry, so a
// Schedule on an HWC post is refused instead of landing in someone's feed.
//
// Channel ids are not secrets (they are useless without the token) and they
// only change when a channel is reconnected, so they live here, not in env.
// List them with: channels(input: { organizationId }) { id name service }.

export type BufferService = 'instagram' | 'facebook' | 'tiktok' | 'threads' | 'linkedin'

export const BUFFER_SERVICES: BufferService[] = [
  'instagram',
  'threads',
  'facebook',
  'tiktok',
  'linkedin',
]

export interface BufferAccount {
  /** Env var holding this account's personal API key. */
  tokenEnv: string
  channels: Partial<Record<BufferService, string>>
}

const ACCOUNTS: Record<string, BufferAccount> = {
  // Buffer org "My Organization" (igor.linnick@gmail.com), listed 2026-09-28.
  yedino: {
    tokenEnv: 'BUFFER_ACCESS_TOKEN_YEDINO',
    channels: {
      instagram: '6ab468f5ea19ca0bdece1589',
      threads: '6ab46922ea19ca0bdece184b',
    },
  },
  // Separate Buffer account (hellosystems111, org "My organization"), listed 2026-10-03.
  // Free plan: 3 channels, 10 scheduled posts per channel. TikTok (hiredrop1,
  // 6ab73629ea19ca0bdeef4eeb) is connected there but left out on purpose: the
  // 4:5 carousels don't belong on TikTok (Igor 2026-10-03).
  hiredrop: {
    tokenEnv: 'BUFFER_ACCESS_TOKEN_HIREDROP',
    channels: {
      instagram: '6ab57e4cea19ca0bdeda5d0f',
      threads: '6ab57e68ea19ca0bdeda5dd4',
    },
  },
}

export function bufferAccountForNiche(niche: string | null | undefined): BufferAccount | null {
  return ACCOUNTS[(niche ?? '').trim().toLowerCase()] ?? null
}

export async function bufferAccountForClinic(
  clinicId: string,
): Promise<{ niche: string | null; account: BufferAccount | null }> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('clinics')
    .select('niche')
    .eq('id', clinicId)
    .maybeSingle()
  const niche = (data as { niche: string | null } | null)?.niche ?? null
  return { niche, account: bufferAccountForNiche(niche) }
}

export function bufferToken(account: BufferAccount): string | null {
  return process.env[account.tokenEnv] || null
}
