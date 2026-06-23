import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { resolveAccess } from '@/lib/auth/session'
import { createUploadSession } from '@/lib/google/recordings'

export const runtime = 'nodejs'

interface PresignBody {
  title?: string
  mimeType: string
  scriptId?: string | null
  duration?: number | null
}

export async function POST(req: Request) {
  const access = await resolveAccess()
  if (!access) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const url = new URL(req.url)
  const clinicId =
    access.role === 'admin'
      ? url.searchParams.get('clinicId') ?? ''
      : access.clinicId

  if (!clinicId) return NextResponse.json({ error: 'clinicId required' }, { status: 400 })

  let body: PresignBody
  try {
    body = (await req.json()) as PresignBody
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  if (!body.mimeType) return NextResponse.json({ error: 'mimeType required' }, { status: 400 })

  const supabase = createServerClient()
  const { data: clinic } = await supabase
    .from('clinics')
    .select('name')
    .eq('id', clinicId)
    .single()

  if (!clinic) return NextResponse.json({ error: 'clinic not found' }, { status: 404 })

  const title = (body.title || 'Untitled').slice(0, 200)
  const safeTitle = title.replace(/[^a-zA-Z0-9 -]/g, '').trim().replace(/\s+/g, '_') || 'recording'
  const dateStr = new Date().toISOString().split('T')[0]
  const ext = body.mimeType === 'video/mp4' ? 'mp4' : 'webm'
  const filename = `${dateStr}_${safeTitle}.${ext}`

  // Pass the client's Origin so Drive includes CORS headers on the upload URL.
  // Without it, the browser's XHR PUT to Drive is blocked by CORS.
  const clientOrigin = req.headers.get('origin') ?? req.headers.get('referer')?.replace(/\/$/, '') ?? ''

  try {
    const { uploadUrl } = await createUploadSession(clinic.name, filename, body.mimeType, clientOrigin)
    return NextResponse.json({ uploadUrl })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'failed to create upload session'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
