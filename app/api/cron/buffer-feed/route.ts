import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { checkCronAuth } from '@/lib/posts/pipeline'
import { dbCronKeyMatches } from '@/lib/cron/db-key'
import { sendPushToAdmins } from '@/lib/push/send'
import { bufferAccountForClinic, bufferToken } from '@/lib/publish/buffer-accounts'
import {
  BufferLimitReached,
  bufferOrganizations,
  bufferScheduled,
  bufferSchedulePost,
} from '@/lib/publish/buffer-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

// POST|GET /api/cron/buffer-feed — tops each brand's Buffer queue up from
// buffer_feed (migration 062). Ticked daily at 16:30 UTC by pg_cron.
//
// Per brand: count scheduled posts on each channel, then hand Buffer the next
// pending rows in seq order while every channel has a free slot. Order is kept
// strictly: if any channel is full, nothing later is scheduled either.
// A row past its due_at gets the next free time instead (MIN_LEAD from now),
// so a missed tick shifts the plan rather than dropping a post.

const MIN_LEAD_MS = 60 * 60_000 // never schedule closer than 1h from now
const FALLBACK_LIMIT = 10 // free plan, if Buffer doesn't report the limit
const SERVICES = ['instagram', 'threads'] as const

interface FeedRow {
  id: string
  clinic_id: string
  seq: number
  source: string
  caption: string
  threads_text: string | null
  threads_topic: string | null
  image_urls: string[]
  due_at: string
  buffer_ids: Record<string, string>
  attempts: number
}

async function feedClinic(clinicId: string, rows: FeedRow[]) {
  const supabase = createServerClient()
  const { niche, account } = await bufferAccountForClinic(clinicId)
  if (!account) return { clinicId, error: `no Buffer account for niche ${niche ?? 'none'}` }
  const token = bufferToken(account)
  if (!token) return { clinicId, error: `${account.tokenEnv} is not set` }

  const channels = SERVICES.filter((s) => account.channels[s])
  const [org] = await bufferOrganizations(token)
  if (!org) return { clinicId, error: 'Buffer account has no organization' }
  const limit = org.scheduledLimit ?? FALLBACK_LIMIT

  const free: Record<string, number> = {}
  for (const s of channels) {
    const { count } = await bufferScheduled(token, org.id, account.channels[s]!)
    free[s] = Math.max(0, limit - count)
  }

  const done: string[] = []
  for (const row of rows) {
    const ids = { ...row.buffer_ids }
    const minDue = Date.now() + MIN_LEAD_MS
    const dueAt = new Date(Math.max(new Date(row.due_at).getTime(), minDue)).toISOString()
    let failure: string | null = null
    let limitHit = false

    for (const s of channels) {
      if (ids[s]) continue
      if (free[s] <= 0) break
      try {
        ids[s] = await bufferSchedulePost(token, {
          channelId: account.channels[s]!,
          service: s,
          text: s === 'threads' ? (row.threads_text ?? row.caption) : row.caption,
          imageUrls: row.image_urls,
          dueAt,
          threadsTopic: row.threads_topic,
        })
        free[s]--
      } catch (e) {
        failure = e instanceof Error ? e.message : String(e)
        limitHit = e instanceof BufferLimitReached
        break
      }
    }

    // Always save what Buffer accepted, before any exit — a channel that got
    // its post must not get it again on the next tick.
    const complete = channels.every((s) => ids[s])
    const attempts = failure && !limitHit ? row.attempts + 1 : row.attempts
    await supabase
      .from('buffer_feed')
      .update({
        buffer_ids: ids,
        due_at: Object.keys(ids).length ? dueAt : row.due_at,
        status: complete ? 'scheduled' : 'pending',
        attempts,
        last_error: failure ? failure.slice(0, 1000) : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
    if (failure && !limitHit && attempts >= 3) {
      await sendPushToAdmins({ title: 'Buffer feed stuck', body: `${row.source}: ${failure}`.slice(0, 200), url: '/scheduler' })
    }
    if (!complete) break // keep the order: nothing later goes before this row
    done.push(`${row.source} @ ${dueAt}`)
  }
  return { clinicId, free, scheduled: done }
}

async function handle(req: Request) {
  if (!checkCronAuth(req) && !(await dbCronKeyMatches(req))) {
    return NextResponse.json({ error: 'cron auth required' }, { status: 401 })
  }
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('buffer_feed')
    .select('id, clinic_id, seq, source, caption, threads_text, threads_topic, image_urls, due_at, buffer_ids, attempts')
    .eq('status', 'pending')
    .order('seq', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const byClinic = new Map<string, FeedRow[]>()
  for (const r of (data ?? []) as FeedRow[]) {
    byClinic.set(r.clinic_id, [...(byClinic.get(r.clinic_id) ?? []), r])
  }
  const results = []
  for (const [clinicId, rows] of Array.from(byClinic)) {
    try {
      results.push(await feedClinic(clinicId, rows))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await sendPushToAdmins({ title: 'Buffer feed failed', body: msg.slice(0, 200), url: '/scheduler' })
      results.push({ clinicId, error: msg })
    }
  }
  return NextResponse.json({ ok: true, results })
}

export const GET = handle
export const POST = handle
