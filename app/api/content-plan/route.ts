import { resolveAccess } from '@/lib/auth/session'
import { loadStructuredPlan, replaceStructuredPlan, type ReplaceWeekInput } from '@/lib/content-plan/store'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const access = await resolveAccess()
  if (!access) return Response.json({ error: 'auth required' }, { status: 401 })

  const url = new URL(req.url)
  const clinicId =
    url.searchParams.get('clinicId') ??
    (access.role === 'admin' ? '' : access.clinicId)

  if (!clinicId) return Response.json({ error: 'clinicId required' }, { status: 400 })

  try {
    const plan = await loadStructuredPlan(clinicId)
    return Response.json({ plan })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return Response.json({ error: msg }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return Response.json({ error: 'admin required' }, { status: 403 })
  }

  let body: { clinicId: string; weeks: ReplaceWeekInput[] }
  try {
    body = (await req.json()) as { clinicId: string; weeks: ReplaceWeekInput[] }
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const { clinicId, weeks } = body
  if (!clinicId || !Array.isArray(weeks)) {
    return Response.json({ error: 'clinicId and weeks array required' }, { status: 400 })
  }

  try {
    await replaceStructuredPlan(clinicId, weeks)
    return Response.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return Response.json({ error: msg }, { status: 500 })
  }
}
