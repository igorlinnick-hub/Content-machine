import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { saveInsights } from '@/lib/supabase/context'
import { resolveAccess } from '@/lib/auth/session'
import { createAccessToken } from '@/lib/auth/tokens'

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

  // Only admin can create new clinics. A doctor cookie can only edit (PATCH).
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json(
      { error: 'admin access required to create a clinic' },
      { status: 403 }
    )
  }

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
      await saveInsights(
        data.id,
        contrarian_opinions.map((text) => ({ type: 'opinion' as const, content: text }))
      )
    }

    // Bootstrap a fresh doctor token alongside the clinic.
    const tokenRow = await createAccessToken({ clinicId: data.id, role: 'doctor' })

    return NextResponse.json({ clinic: data, token: tokenRow.token })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  let body: OnboardingPostBody
  try {
    body = (await req.json()) as OnboardingPostBody
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const access = await resolveAccess()
  if (!access) {
    return NextResponse.json({ error: 'auth required' }, { status: 401 })
  }
  // Admin must specify which clinic to edit via the cookie or via creating
  // through POST. PATCH only edits the clinic the cookie is scoped to.
  if (access.role === 'admin') {
    return NextResponse.json(
      { error: 'admin must edit clinics directly via SQL or POST flow' },
      { status: 400 }
    )
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
      .update({
        name,
        doctor_name: body.doctor_name?.trim() || null,
        services: sanitizeList(body.services),
        content_pillars,
        deep_dive_topics,
      })
      .eq('id', access.clinicId)
      .select('id, name')
      .single()

    if (error || !data) throw error ?? new Error('update returned no row')

    if (contrarian_opinions.length > 0) {
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
