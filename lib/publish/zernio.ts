import { createServerClient } from '@/lib/supabase/server'

// Zernio (zernio.com) publishes a brand's X and LinkedIn posts — the networks
// Buffer's free plan and our own apps can't reach (X has no free API for new
// developers; LinkedIn pages need Community Management API review). Chosen by
// Igor 2026-10-28. API reference: https://zernio.com/openapi.json.
//
// Keyed by `clinics.niche`, like buffer-accounts.ts. Account ids are not
// secrets; list them with GET /v1/accounts.
//
// Shapes checked 2026-10-29 against the spec:
// - POST /v1/posts { content, platforms: [{ platform, accountId, platformSpecificData }], scheduledFor };
// - a scheduledFor in the PAST publishes at once — callers must never send one;
// - LinkedIn document post = one mediaItem of type 'document' + platformSpecificData.documentTitle;
//   firstComment goes in platformSpecificData too;
// - X can't be pinned through the API (POST /posts/{id}/pin is Facebook only);
// - X is billed per call at X's price: $0.015 a post, $0.20 with a link.

export type ZernioChannel = 'x' | 'linkedin'

const PLATFORM: Record<ZernioChannel, string> = { x: 'twitter', linkedin: 'linkedin' }

export interface ZernioAccount {
  /** Env var holding the Zernio API key. */
  tokenEnv: string
  channels: Partial<Record<ZernioChannel, string>>
}

const ACCOUNTS: Record<string, ZernioAccount> = {
  // Zernio account hellosystems111, profile Default; connected 2026-10-28/29.
  hiredrop: {
    tokenEnv: 'ZERNIO_API_KEY',
    channels: {
      linkedin: '6ae2fabade937bee78ca5fe2', // page HireDrop (organization)
      x: '6ae3be7d8b995bed0a88a935', // @hiredrop_io
    },
  },
}

export async function zernioAccountForClinic(
  clinicId: string,
): Promise<{ niche: string | null; account: ZernioAccount | null }> {
  const { data } = await createServerClient().from('clinics').select('niche').eq('id', clinicId).maybeSingle()
  const niche = (data as { niche: string | null } | null)?.niche ?? null
  return { niche, account: ACCOUNTS[(niche ?? '').trim().toLowerCase()] ?? null }
}

export function zernioToken(account: ZernioAccount): string | null {
  return process.env[account.tokenEnv] || null
}

/** Schedules one post on one channel; returns Zernio's post id. */
export async function zernioSchedulePost(
  token: string,
  input: {
    accountId: string
    channel: ZernioChannel
    text: string
    mediaUrls: string[]
    documentTitle: string | null
    firstComment: string | null
    scheduledFor: string
    /** Same key on a retry → Zernio returns the post it already made (24 h). */
    idempotencyKey: string
    source: string
  },
): Promise<string> {
  if (new Date(input.scheduledFor).getTime() <= Date.now()) {
    throw new Error(`refusing a past scheduledFor (${input.scheduledFor}): Zernio would publish it at once`)
  }
  const platformSpecificData: Record<string, string> = {}
  if (input.channel === 'linkedin') {
    if (input.documentTitle) platformSpecificData.documentTitle = input.documentTitle
    if (input.firstComment) platformSpecificData.firstComment = input.firstComment
  }
  const res = await fetch('https://zernio.com/api/v1/posts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': input.idempotencyKey,
    },
    body: JSON.stringify({
      content: input.text,
      mediaItems: input.mediaUrls.map((url) =>
        input.documentTitle ? { url, type: 'document', title: input.documentTitle } : { url },
      ),
      platforms: [{ platform: PLATFORM[input.channel], accountId: input.accountId, platformSpecificData }],
      scheduledFor: input.scheduledFor,
      timezone: 'UTC',
      metadata: { source: input.source },
    }),
    cache: 'no-store',
  })
  const json = (await res.json().catch(() => null)) as
    | { post?: { _id: string }; error?: string; message?: string; code?: string }
    | null
  if (!res.ok || !json?.post?._id) {
    throw new Error(`Zernio ${res.status}: ${json?.error ?? json?.message ?? 'no post id'}${json?.code ? ` (${json.code})` : ''}`)
  }
  return json.post._id
}
