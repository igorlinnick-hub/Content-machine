import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { resolveAccess } from '@/lib/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Remove a clip row from the Ready videos list — for failed runs and
// rows stuck in 'processing' after a dead invocation. DB row only;
// Drive files (original / partial artifacts) stay where they are.

export async function DELETE(
  _req: Request,
  { params }: { params: { clipId: string } }
) {
  const access = await resolveAccess()
  if (!access) return NextResponse.json({ error: 'auth required' }, { status: 401 })
  if (access.role !== 'admin') {
    return NextResponse.json({ error: 'admin required' }, { status: 403 })
  }

  const supabase = createServerClient()
  const { error } = await supabase
    .from('clips')
    .delete()
    .eq('id', params.clipId)
    .in('status', ['failed', 'processing', 'pending'])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
