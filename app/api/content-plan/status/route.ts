import { resolveAccess } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return Response.json({ error: 'admin required' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const clinicId = searchParams.get('clinicId')?.trim()
  if (!clinicId) return Response.json({ error: 'clinicId required' }, { status: 400 })

  const supabase = createServerClient()
  const { data } = await supabase
    .from('clinics')
    .select('plan_status, plan_error')
    .eq('id', clinicId)
    .single()

  return Response.json({
    status: data?.plan_status ?? null,
    error: data?.plan_error ?? null,
  })
}
