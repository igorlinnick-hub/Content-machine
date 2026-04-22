import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import type { Tone } from '@/types'

export const runtime = 'nodejs'

const TONES: Tone[] = ['professional', 'educational', 'conversational']

interface OnboardingPostBody {
  name: string
  doctor_name?: string
  services?: string[]
  audience?: string
  tone?: Tone
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

  const tone = body.tone && TONES.includes(body.tone) ? body.tone : 'educational'

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
        tone,
        medical_restrictions: sanitizeList(body.medical_restrictions),
      })
      .select('id, name')
      .single()

    if (error || !data) throw error ?? new Error('insert returned no row')

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
