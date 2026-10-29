import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { checkCronAuth } from '@/lib/posts/pipeline'
import { dbCronKeyMatches } from '@/lib/cron/db-key'
import { sendPushToAdmins } from '@/lib/push/send'
import { zernioAccountForClinic, zernioSchedulePost, zernioToken, type ZernioChannel } from '@/lib/publish/zernio'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

// POST|GET /api/cron/zernio-feed — hands Zernio each brand's X and LinkedIn
// posts from zernio_feed (migration 067). Ticked daily at 15:00 UTC by pg_cron.
//
// Zernio keeps the schedule itself and has no slot cap, so the horizon is the
// only gate: every pending row due within HORIZON goes over at its own due_at;
// later rows stay in the table, where the plan can still change.
//
// A row past its due_at (missed tick, key not set yet…) keeps its time of day
// and moves a day at a time onto the first day that channel has no post within
// MIN_GAP — so after downtime the late posts go out one a day, not in a burst
// (the buffer_feed problem, publish.md F5). A LinkedIn document row without
// its PDF is held back, never sent as plain text.

const DAY = 86_400_000
const HORIZON_MS = 14 * DAY
const MIN_LEAD_MS = 60 * 60_000 // a past scheduledFor would publish at once
const MIN_GAP_MS = 20 * 60 * 60_000
const DOC_WARN_MS = 2 * DAY // start pushing about a missing PDF this close to due

interface FeedRow {
  id: string
  clinic_id: string
  source: string
  channel: ZernioChannel
  text: string
  media_urls: string[]
  document_title: string | null
  first_comment: string | null
  due_at: string
  attempts: number
}

async function feedClinic(clinicId: string, rows: FeedRow[]) {
  const supabase = createServerClient()
  const { niche, account } = await zernioAccountForClinic(clinicId)
  if (!account) return { clinicId, error: `no Zernio account for niche ${niche ?? 'none'}` }
  const token = zernioToken(account)
  if (!token) return { clinicId, error: `${account.tokenEnv} is not set` }

  const now = Date.now()
  // When each channel already posts: what Zernio holds plus pending rows still on time.
  const busy: Partial<Record<ZernioChannel, number[]>> = {}
  const mark = (ch: ZernioChannel, t: number) => (busy[ch] ??= []).push(t)
  const { data: held } = await supabase
    .from('zernio_feed')
    .select('channel, due_at')
    .eq('clinic_id', clinicId)
    .eq('status', 'scheduled')
    .gte('due_at', new Date(now - DAY).toISOString())
  for (const r of (held ?? []) as Array<{ channel: ZernioChannel; due_at: string }>) mark(r.channel, Date.parse(r.due_at))
  for (const r of rows) if (Date.parse(r.due_at) >= now + MIN_LEAD_MS) mark(r.channel, Date.parse(r.due_at))

  const scheduled: string[] = []
  const problems: string[] = []
  for (const row of rows) {
    const update = (patch: Record<string, unknown>) =>
      supabase
        .from('zernio_feed')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', row.id)
    const planned = Date.parse(row.due_at)

    if (row.document_title && !row.media_urls.length) {
      await update({ last_error: 'waiting for the document PDF' })
      if (planned - now < DOC_WARN_MS) problems.push(`${row.source}: no PDF yet, due ${row.due_at.slice(0, 16)}`)
      continue
    }
    const accountId = account.channels[row.channel]
    if (!accountId) {
      await update({ last_error: `no ${row.channel} account connected for this brand` })
      problems.push(`${row.source}: no ${row.channel} account`)
      continue
    }

    let t = planned
    if (t < now + MIN_LEAD_MS) {
      const taken = busy[row.channel] ?? []
      while (t < now + MIN_LEAD_MS || taken.some((b) => Math.abs(b - t) < MIN_GAP_MS)) t += DAY
    }
    const dueAt = new Date(t).toISOString()
    try {
      const postId = await zernioSchedulePost(token, {
        accountId,
        channel: row.channel,
        text: row.text,
        mediaUrls: row.media_urls,
        documentTitle: row.document_title,
        firstComment: row.first_comment,
        scheduledFor: dueAt,
        idempotencyKey: `zernio-feed:${row.id}`,
        source: row.source,
      })
      await update({ status: 'scheduled', zernio_post_id: postId, due_at: dueAt, last_error: null })
      mark(row.channel, t)
      scheduled.push(`${row.source} → ${row.channel} @ ${dueAt}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await update({ attempts: row.attempts + 1, last_error: msg.slice(0, 1000) })
      problems.push(`${row.source}: ${msg}`)
    }
  }
  return { clinicId, scheduled, problems }
}

async function handle(req: Request) {
  if (!checkCronAuth(req) && !(await dbCronKeyMatches(req))) {
    return NextResponse.json({ error: 'cron auth required' }, { status: 401 })
  }
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('zernio_feed')
    .select('id, clinic_id, source, channel, text, media_urls, document_title, first_comment, due_at, attempts')
    .eq('status', 'pending')
    .lte('due_at', new Date(Date.now() + HORIZON_MS).toISOString())
    .order('due_at', { ascending: true })
    .order('seq', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const byClinic = new Map<string, FeedRow[]>()
  for (const r of (data ?? []) as FeedRow[]) {
    byClinic.set(r.clinic_id, [...(byClinic.get(r.clinic_id) ?? []), r])
  }
  const results = []
  for (const [clinicId, rows] of Array.from(byClinic)) {
    let result: Awaited<ReturnType<typeof feedClinic>>
    try {
      result = await feedClinic(clinicId, rows)
    } catch (e) {
      result = { clinicId, error: e instanceof Error ? e.message : String(e) }
    }
    const trouble = 'error' in result ? [result.error] : result.problems
    if (trouble.length) {
      await sendPushToAdmins({ title: 'Zernio feed', body: trouble.join(' · ').slice(0, 200), url: '/scheduler' })
    }
    results.push(result)
  }
  return NextResponse.json({ ok: true, results })
}

export const GET = handle
export const POST = handle
