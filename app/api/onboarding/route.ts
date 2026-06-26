import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { saveInsights } from '@/lib/supabase/context'
import { resolveAccess } from '@/lib/auth/session'
import { createAccessToken, pickAvailableCode, slugifyForCode } from '@/lib/auth/tokens'
import { seedDoctorFromSource } from '@/lib/clinics/seed'

export const runtime = 'nodejs'

interface OnboardingPostBody {
  name: string
  full_name?: string | null
  doctor_name?: string
  niche?: string
  services?: string[]
  deep_dive_topics?: string[]
  content_pillars?: string[]
  contrarian_opinions?: string[]
  // Admin editing a specific clinic by ID (PATCH only)
  clinic_id?: string
  // Multi-doctor: attach new doctor to an existing brand group
  group_id?: string
  // Copy templates/categories/references from this clinic into the new one
  seed_from_clinic_id?: string
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

    // Resolve group_id: use existing group or create a new one for this brand.
    let groupId = body.group_id?.trim() || null
    let brandName = name
    let brandLogo: string | null = null

    if (groupId) {
      // Adding a doctor to an existing brand — inherit brand name + logo from group.
      const { data: group } = await supabase
        .from('clinic_groups')
        .select('name, logo_url')
        .eq('id', groupId)
        .single()
      if (group) {
        brandName = group.name
        brandLogo = group.logo_url ?? null
      }
    } else {
      // New brand — create the group first, then attach this clinic to it.
      const { data: newGroup, error: groupErr } = await supabase
        .from('clinic_groups')
        .insert({ name })
        .select('id')
        .single()
      if (groupErr || !newGroup) throw groupErr ?? new Error('failed to create clinic group')
      groupId = newGroup.id
    }

    const { data, error } = await supabase
      .from('clinics')
      .insert({
        name: brandName,
        full_name: body.full_name ?? null,
        niche: body.niche?.trim() || 'regenerative_medicine',
        doctor_name: body.doctor_name?.trim() || null,
        services: sanitizeList(body.services),
        audience: body.audience?.trim() || null,
        tone: body.tone?.trim() || null,
        medical_restrictions: sanitizeList(body.medical_restrictions),
        content_pillars,
        deep_dive_topics,
        group_id: groupId,
        ...(brandLogo ? { logo_url: brandLogo } : {}),
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

    // Seed templates/categories/references from an existing doctor if requested.
    if (body.seed_from_clinic_id) {
      await seedDoctorFromSource(data.id, body.seed_from_clinic_id).catch((e) =>
        console.error('[onboarding] seed failed (non-fatal):', e?.message)
      )
    }

    // Bootstrap BOTH access tokens (doctor + team) with memorable
    // slug-codes derived from the doctor name (or clinic name). So when admin
    // onboards a new doctor they instantly have the 2 codes to hand off.
    const slugBase = body.doctor_name?.trim() || name
    const slug = slugifyForCode(slugBase)
    const doctorCode = await pickAvailableCode(`${slug}-doctor`)
    const teamCode = await pickAvailableCode(`${slug}-team`)

    const [doctorRow, teamRow] = await Promise.all([
      createAccessToken({
        clinicId: data.id,
        role: 'doctor',
        label: body.doctor_name?.trim() || undefined,
        code: doctorCode,
      }),
      createAccessToken({
        clinicId: data.id,
        role: 'editor',
        label: 'Team',
        code: teamCode,
      }),
    ])

    return NextResponse.json({
      clinic: data,
      group_id: groupId,
      // Legacy field — kept so the existing onboarding UI still works.
      token: doctorRow.token,
      doctor: {
        token: doctorRow.token,
        code: doctorRow.code,
        label: doctorRow.label,
      },
      team: {
        token: teamRow.token,
        code: teamRow.code,
        label: teamRow.label,
      },
    })
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

  // Resolve which clinic to edit:
  // - Admin: must supply clinic_id in the request body
  // - Doctor/editor: always edits their own clinic
  let targetClinicId: string
  if (access.role === 'admin') {
    if (!body.clinic_id) {
      return NextResponse.json(
        { error: 'admin must supply clinic_id to edit a clinic' },
        { status: 400 }
      )
    }
    targetClinicId = body.clinic_id
  } else {
    targetClinicId = access.clinicId
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
        full_name: body.full_name ?? null,
        doctor_name: body.doctor_name?.trim() || null,
        services: sanitizeList(body.services),
        content_pillars,
        deep_dive_topics,
      })
      .eq('id', targetClinicId)
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
