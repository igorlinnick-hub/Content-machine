import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createServerClient } from '@/lib/supabase/server'
import { checkCronAuth } from '@/lib/posts/pipeline'
import { sendPushToAdmins } from '@/lib/push/send'
import { metaCredsForClinic } from '@/lib/publish/meta-creds'
import {
  MetaApiError,
  createInstagramContainer,
  createThreadsContainer,
  publishInstagramContainer,
  publishThreadsContainer,
  type PublishResult,
} from '@/lib/publish/meta-graph'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST|GET /api/cron/meta-publish — publishes meta_posts whose time has come.
//
// Ticked every 5 minutes by pg_cron (migration 061) with x-cron-key =
// app_secrets.meta_publish_cron; CRON_SECRET also works for a manual run.
//
// A row is claimed (scheduled → publishing) before anything is sent, so two
// overlapping ticks never take the same post. A tick that dies mid-publish
// leaves the row in `publishing`; after STALE_MIN it is retried, and the
// retry first asks Meta whether the saved container is already PUBLISHED.
// Retryable errors go back to `scheduled` until MAX_ATTEMPTS; the rest fail
// at once with a push to admins — nothing is lost silently.

const MAX_ATTEMPTS = 5
const STALE_MIN = 15
const PER_TICK = 4 // ~30–60s each; stays well inside maxDuration

interface MetaPostRow {
  id: string
  clinic_id: string
  network: 'instagram' | 'threads'
  caption: string
  image_urls: string[]
  publish_at: string
  status: string
  attempts: number
  container_id: string | null
  source: string | null
}

async function authorized(req: Request): Promise<boolean> {
  if (checkCronAuth(req)) return true
  const key = req.headers.get('x-cron-key')
  if (!key) return false
  const { data } = await createServerClient()
    .from('app_secrets')
    .select('value')
    .eq('name', 'meta_publish_cron')
    .maybeSingle()
  const expected = (data as { value: string } | null)?.value ?? ''
  const a = Buffer.from(key)
  const b = Buffer.from(expected)
  return expected.length > 0 && a.length === b.length && timingSafeEqual(a, b)
}

async function publishOne(row: MetaPostRow): Promise<PublishResult> {
  const supabase = createServerClient()
  const creds = await metaCredsForClinic(row.clinic_id)
  const saveContainer = async (id: string) => {
    await supabase.from('meta_posts').update({ container_id: id, updated_at: new Date().toISOString() }).eq('id', row.id)
  }

  if (row.network === 'instagram') {
    if (!creds.instagram) throw new MetaApiError('no Instagram connection for this brand in Hellometrix', false)
    const containerId = row.container_id ?? (await createInstagramContainer(creds.instagram, row.image_urls, row.caption))
    if (!row.container_id) await saveContainer(containerId)
    return publishInstagramContainer(creds.instagram, containerId)
  }
  if (!creds.threads) throw new MetaApiError('no Threads connection for this brand in Hellometrix', false)
  const containerId = row.container_id ?? (await createThreadsContainer(creds.threads, row.image_urls, row.caption))
  if (!row.container_id) await saveContainer(containerId)
  return publishThreadsContainer(creds.threads, containerId)
}

async function handle(req: Request) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: 'cron auth required' }, { status: 401 })
  }
  const supabase = createServerClient()
  const now = new Date()
  const stale = new Date(now.getTime() - STALE_MIN * 60_000).toISOString()

  const { data: due, error } = await supabase
    .from('meta_posts')
    .select('id, clinic_id, network, caption, image_urls, publish_at, status, attempts, container_id, source')
    .lte('publish_at', now.toISOString())
    .or(`status.eq.scheduled,and(status.eq.publishing,claimed_at.lt.${stale})`)
    .order('publish_at', { ascending: true })
    .limit(PER_TICK)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const results: Array<{ id: string; source: string | null; network: string; ok: boolean; detail: string }> = []

  for (const row of (due ?? []) as MetaPostRow[]) {
    // Claim: only one tick wins the row.
    const { data: claimed } = await supabase
      .from('meta_posts')
      .update({
        status: 'publishing',
        claimed_at: new Date().toISOString(),
        attempts: row.attempts + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('status', row.status)
      .eq('attempts', row.attempts)
      .select('id')
    if (!claimed?.length) continue

    try {
      const r = await publishOne(row)
      await supabase
        .from('meta_posts')
        .update({
          status: 'published',
          media_id: r.mediaId,
          permalink: r.permalink,
          published_at: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
      results.push({ id: row.id, source: row.source, network: row.network, ok: true, detail: r.permalink ?? 'published' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const retryable = e instanceof MetaApiError ? e.retryable : true
      const giveUp = !retryable || row.attempts + 1 >= MAX_ATTEMPTS
      await supabase
        .from('meta_posts')
        .update({
          status: giveUp ? 'failed' : 'scheduled',
          last_error: msg.slice(0, 1000),
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
      if (giveUp) {
        await sendPushToAdmins({
          title: `${row.network === 'instagram' ? 'Instagram' : 'Threads'} post failed`,
          body: `${row.source ?? row.id}: ${msg}`.slice(0, 200),
          url: '/scheduler',
        })
      }
      results.push({ id: row.id, source: row.source, network: row.network, ok: false, detail: msg })
    }
  }

  return NextResponse.json({ ok: true, checked: due?.length ?? 0, results })
}

export const GET = handle
export const POST = handle
