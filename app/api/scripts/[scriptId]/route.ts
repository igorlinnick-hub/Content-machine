import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { resolveAccess } from '@/lib/auth/session'

export const runtime = 'nodejs'

interface PatchBody {
  topic?: string
  hook?: string | null
  full_script?: string
  starred?: boolean
}

/**
 * Edit a saved script in place: text, title/hook, or the star flag.
 * `full_script` is stored RAW (slide markup intact) — the reading
 * surfaces clean it at display time, the carousel splitter needs it.
 */
export async function PATCH(
  req: Request,
  { params }: { params: { scriptId: string } }
) {
  const access = await resolveAccess()
  if (!access) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const { scriptId } = params
  if (!scriptId) return NextResponse.json({ error: 'scriptId required' }, { status: 400 })

  const body = (await req.json().catch(() => null)) as PatchBody | null
  if (!body) return NextResponse.json({ error: 'invalid body' }, { status: 400 })

  const supabase = createServerClient()

  const { data: script } = await supabase
    .from('scripts')
    .select('id, clinic_id')
    .eq('id', scriptId)
    .single()

  if (!script) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (access.role !== 'admin' && script.clinic_id !== access.clinicId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const patch: {
    starred?: boolean
    topic?: string
    hook?: string | null
    full_script?: string
    word_count?: number
    updated_at?: string
  } = {}

  if (typeof body.starred === 'boolean') patch.starred = body.starred

  if (typeof body.topic === 'string') {
    const topic = body.topic.trim()
    if (!topic) return NextResponse.json({ error: 'topic cannot be empty' }, { status: 400 })
    patch.topic = topic
  }

  if (body.hook !== undefined) {
    const hook = typeof body.hook === 'string' ? body.hook.trim() : ''
    patch.hook = hook || null
  }

  if (typeof body.full_script === 'string') {
    const text = body.full_script.trim()
    if (!text) return NextResponse.json({ error: 'script cannot be empty' }, { status: 400 })
    patch.full_script = text
    patch.word_count = text.split(/\s+/).filter(Boolean).length
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
  }

  // Stamp updated_at only on content edits — starring isn't an edit.
  // The critic score is left as-is: it graded the original draft, and
  // the UI marks hand-edited scripts so the number can be read in context.
  const contentEdit =
    'full_script' in patch || 'topic' in patch || 'hook' in patch
  if (contentEdit) patch.updated_at = new Date().toISOString()

  const { data: updated, error } = await supabase
    .from('scripts')
    .update(patch)
    .eq('id', scriptId)
    .select('id, topic, hook, full_script, word_count, starred, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, script: updated })
}

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
