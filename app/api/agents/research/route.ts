import { NextResponse } from 'next/server'
import { runResearch } from '@/lib/agents/research'
import { loadClinicList, loadClinicProfile } from '@/lib/supabase/context'
import { checkCronAuth } from '@/lib/cron/auth'

export const runtime = 'nodejs'
export const maxDuration = 300

interface ResearchBody {
  clinicId?: string
}

export async function POST(req: Request) {
  const unauth = checkCronAuth(req)
  if (unauth) return unauth

  let body: ResearchBody = {}
  try {
    const text = await req.text()
    if (text) body = JSON.parse(text) as ResearchBody
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  try {
    const clinicIds = body.clinicId
      ? [body.clinicId]
      : (await loadClinicList()).map((c) => c.id)

    const results = []
    for (const id of clinicIds) {
      try {
        const clinic = await loadClinicProfile(id)
        const { signals, output } = await runResearch({ clinicId: id, clinic })
        results.push({
          clinic_id: id,
          signals_saved: signals.length,
          topics: output.trending_topics.length,
        })
      } catch (e) {
        results.push({
          clinic_id: id,
          error: e instanceof Error ? e.message : 'unknown error',
        })
      }
    }

    return NextResponse.json({ results })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// Cron may GET instead of POST depending on the provider.
export async function GET(req: Request) {
  return POST(req)
}
