import { createServerClient } from '@/lib/supabase/server'
import type { InstagramCreds, ThreadsCreds } from './meta-graph'

// Meta tokens for direct posting. Two sources:
//
// 1. DIRECT — a Meta system-user token kept in env (Vercel prod). Used for the
//    Instagram of a niche listed below. A system user cannot publish Threads
//    (graph.threads.net rejects its token), so that brand's Threads still comes
//    from Hellometrix.
// 2. Hellometrix — its Meta app owns the OAuth ("Allow" once per brand), stores
//    the tokens and refreshes them before the 60 days run out. Content Machine
//    only asks for the current ones right before publishing.
//    Contract: docs/META-PUBLISH.md. Same link as lib/hellometrix/published-posts.ts:
//    clinics.hellometrix_client_id + HELLOMETRIX_API_URL / HELLOMETRIX_API_KEY.

export interface MetaPublishCreds {
  instagram: InstagramCreds | null
  threads: ThreadsCreds | null
}

interface DirectMetaAccount {
  /** Env var holding the system-user token. */
  tokenEnv: string
  /** Instagram Business account id linked to the brand's Facebook Page. */
  igUserId: string
  graphHost: string
}

// Keyed by `clinics.niche` (same key as lib/publish/buffer-accounts.ts).
const DIRECT_META: Record<string, DirectMetaAccount> = {
  // HireDrop: system user "HireDrop Campaign Builder", Page → IG hiredrop.io.
  // Checked 2026-10-05 via me/permissions: instagram_content_publish present.
  hiredrop: {
    tokenEnv: 'META_SYSTEM_USER_TOKEN',
    igUserId: '17841446093945559',
    graphHost: 'graph.facebook.com',
  },
}

async function hellometrixCreds(hmClientId: string | null | undefined): Promise<MetaPublishCreds> {
  const apiUrl = process.env.HELLOMETRIX_API_URL
  const apiKey = process.env.HELLOMETRIX_API_KEY
  if (!apiUrl || !apiKey) throw new Error('HELLOMETRIX_API_URL / HELLOMETRIX_API_KEY not set')
  if (!hmClientId) throw new Error('clinic has no hellometrix_client_id')

  const res = await fetch(`${apiUrl}/api/cm/meta-publish-creds?clientId=${hmClientId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Hellometrix meta-publish-creds: ${res.status} ${await res.text()}`)
  const body = (await res.json()) as Partial<MetaPublishCreds>
  return { instagram: body.instagram ?? null, threads: body.threads ?? null }
}

export async function metaCredsForClinic(clinicId: string): Promise<MetaPublishCreds> {
  const supabase = createServerClient()
  const { data: clinic } = await supabase
    .from('clinics')
    .select('niche, hellometrix_client_id')
    .eq('id', clinicId)
    .maybeSingle()
  const row = clinic as { niche: string | null; hellometrix_client_id: string | null } | null

  const direct = DIRECT_META[(row?.niche ?? '').trim().toLowerCase()]
  if (!direct) return hellometrixCreds(row?.hellometrix_client_id)

  const accessToken = process.env[direct.tokenEnv]
  if (!accessToken) throw new Error(`${direct.tokenEnv} not set`)
  // Threads is best-effort here: a Hellometrix outage must not stop Instagram.
  // A Threads row then fails with "no Threads connection" and is retried.
  const threads = await hellometrixCreds(row?.hellometrix_client_id)
    .then((c) => c.threads)
    .catch(() => null)
  return {
    instagram: { igUserId: direct.igUserId, accessToken, graphHost: direct.graphHost },
    threads,
  }
}
