import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { resolveAccess } from '@/lib/auth/session'

export const runtime = 'nodejs'

export async function DELETE(
  _req: Request,
  { params }: { params: { scriptId: string } }
) {
  const access = await resolveAccess()
  if (!access) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const { scriptId } = params
  if (!scriptId) return NextResponse.json({ error: 'scriptId required' }, { status: 400 })

  const supabase = createServerClient()

  // Verify the script belongs to a clinic this user can access
  const { data: script } = await supabase
    .from('scripts')
    .select('id, clinic_id')
    .eq('id', scriptId)
    .single()

  if (!script) return NextResponse.json({ error: 'not found' }, { status: 404 })

  if (access.role !== 'admin' && script.clinic_id !== access.clinicId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { error } = await supabase.from('scripts').delete().eq('id', scriptId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
