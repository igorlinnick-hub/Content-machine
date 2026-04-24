import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { deactivateFewShotExample } from '@/lib/supabase/context'

export const runtime = 'nodejs'

export async function DELETE(
  _req: Request,
  { params }: { params: { exampleId: string } }
) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }
  try {
    await deactivateFewShotExample(params.exampleId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
