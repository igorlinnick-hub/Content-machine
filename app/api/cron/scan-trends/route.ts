import { NextResponse } from 'next/server'
import { checkCronAuth } from '@/lib/cron/auth'
import { loadClinicList } from '@/lib/supabase/context'
import { enqueueIngest, type IngestPlatform } from '@/lib/arsenal/store'
import {
  loadTrendSources,
  buildSourceUrl,
  touchTrendScanned,
} from '@/lib/trends/sources'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Weekly cron. Walks each clinic's active trend_sources and SEEDS the
// ingest queue with account/hashtag listing URLs (intent ingest_only,
// tagged discovered_via=trend_scan:<source_id>). It does NOT fetch video
// — Vercel can't run yt-dlp. The local script-arsenal-ingest skill picks
// up these rows, resolves the fresh individual videos, analyses them, and
// posts drafts back for admin approval in /arsenal.
//
// Gated by ENABLE_TREND_SCAN (cheap, independent of the LLM kill switch —
// enqueueing is free; the skill's extraction inherits ENABLE_LLM_AGENTS).
export async function GET(req: Request) {
  const authErr = checkCronAuth(req)
  if (authErr) return authErr

  if (process.env.ENABLE_TREND_SCAN !== 'true') {
    return NextResponse.json({ ok: true, skipped: 'ENABLE_TREND_SCAN not set' })
  }

  const clinics = await loadClinicList()
  let seeded = 0
  let reused = 0
  const errors: string[] = []

  for (const clinic of clinics) {
    const sources = await loadTrendSources(clinic.id, { activeOnly: true })
    for (const source of sources) {
      try {
        const url = buildSourceUrl(source)
        const res = await enqueueIngest({
          clinicId: clinic.id,
          sourceUrl: url,
          platform: source.platform as IngestPlatform,
          intent: 'ingest_only',
          discoveredVia: `trend_scan:${source.id}`,
        })
        if (res.reused) reused++
        else seeded++
        await touchTrendScanned(source.id)
      } catch (e) {
        errors.push(
          `${clinic.id}/${source.handle_or_hashtag}: ${
            e instanceof Error ? e.message : 'unknown'
          }`
        )
      }
    }
  }

  return NextResponse.json({ ok: true, seeded, reused, errors })
}
