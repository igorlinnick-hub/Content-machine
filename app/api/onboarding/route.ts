import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { saveInsights } from '@/lib/supabase/context'

export const runtime = 'nodejs'

interface OnboardingPostBody {
  name: string
  doctor_name?: string
  services?: string[]
  deep_dive_topics?: string[]
  content_pillars?: string[]
  contrarian_opinions?: string[]
  // Legacy / optional — no longer part of the wizard UI but still accepted
  audience?: string
  tone?: string
  medical_restrictions?: string[]
}

export async function POST(req: Request) {
  let body: OnboardingPostBody
  try {
    body = (await req.json()) as OnboardingPostBody
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const name = body.name?.trim()
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const deep_dive_topics = sanitizeList(body.deep_dive_topics)
  const content_pillars = sanitizeList(body.content_pillars)
  const contrarian_opinions = sanitizeList(body.contrarian_opinions)

  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('clinics')
      .insert({
        name,
        niche: 'regenerative_medicine',
        doctor_name: body.doctor_name?.trim() || null,
        services: sanitizeList(body.services),
        audience: body.audience?.trim() || null,
        tone: body.tone?.trim() || null,
        medical_restrictions: sanitizeList(body.medical_restrictions),
        content_pillars,
        deep_dive_topics,
      })
      .select('id, name')
      .single()

    if (error || !data) throw error ?? new Error('insert returned no row')

    if (contrarian_opinions.length > 0) {
      // Supabase client was already scoped to this clinic via createServerClient,
      // but RLS needs app.clinic_id set — saveInsights uses the same server client
      // and writes service-role, so it bypasses RLS.
      await saveInsights(
        data.id,
        contrarian_opinions.map((text) => ({ type: 'opinion' as const, content: text }))
      )
    }

    return NextResponse.json({ clinic: data })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

function sanitizeList(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter((s) => s.length > 0)
}
