import { createServerClient } from '@/lib/supabase/server'
import type { InstagramCreds, ThreadsCreds } from './meta-graph'

// Meta tokens live in Hellometrix, not here: its Meta app owns the OAuth
// ("Allow" once per brand), stores the tokens and refreshes them before the
// 60 days run out. Content Machine only asks for the current ones right
// before publishing. Contract: docs/META-PUBLISH.md.
//
// Same link as lib/hellometrix/published-posts.ts: clinics.hellometrix_client_id
// + HELLOMETRIX_API_URL / HELLOMETRIX_API_KEY.

export interface MetaPublishCreds {
  instagram: InstagramCreds | null
  threads: ThreadsCreds | null
}

export async function metaCredsForClinic(clinicId: string): Promise<MetaPublishCreds> {
  const apiUrl = process.env.HELLOMETRIX_API_URL
  const apiKey = process.env.HELLOMETRIX_API_KEY
  if (!apiUrl || !apiKey) throw new Error('HELLOMETRIX_API_URL / HELLOMETRIX_API_KEY not set')

  const supabase = createServerClient()
  const { data: clinic } = await supabase
    .from('clinics')
    .select('hellometrix_client_id')
    .eq('id', clinicId)
    .maybeSingle()
  const hmClientId = (clinic as { hellometrix_client_id: string | null } | null)?.hellometrix_client_id
  if (!hmClientId) throw new Error('clinic has no hellometrix_client_id')

  const res = await fetch(`${apiUrl}/api/cm/meta-publish-creds?clientId=${hmClientId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Hellometrix meta-publish-creds: ${res.status} ${await res.text()}`)
  const body = (await res.json()) as Partial<MetaPublishCreds>
  return { instagram: body.instagram ?? null, threads: body.threads ?? null }
}
