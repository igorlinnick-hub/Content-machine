import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import { loadStructuredPlan, getCurrentStructuredWeek } from '@/lib/content-plan/store'
import { buildPlanPdfHtml, renderPlanPdf } from '@/lib/content-plan/pdf'

export const dynamic = 'force-dynamic'
// Chromium cold start (~4-6s) + render — well over the 10s default.
export const maxDuration = 60

// GET /api/content-plan/pdf?clinicId=…
// Renders the clinic's full editorial plan as a downloadable A4 PDF.
// Admin picks the clinic via query param; doctor/editor always get their own.
export async function GET(req: Request) {
  const access = await resolveAccess()
  if (!access) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const clinicId =
    access.role === 'admin' ? url.searchParams.get('clinicId') ?? '' : access.clinicId
  if (!clinicId) {
    return NextResponse.json({ error: 'clinicId required' }, { status: 400 })
  }

  const supabase = createServerClient()
  const [{ data: clinic }, plan, currentWeek] = await Promise.all([
    supabase.from('clinics').select('name').eq('id', clinicId).single(),
    loadStructuredPlan(clinicId),
    getCurrentStructuredWeek(clinicId),
  ])

  if (plan.length === 0) {
    return NextResponse.json({ error: 'no content plan for this clinic yet' }, { status: 404 })
  }

  const clinicName = clinic?.name ?? 'Clinic'
  const now = new Date()
  const generatedOn = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  try {
    const html = buildPlanPdfHtml({
      clinicName,
      plan,
      currentWeekId: currentWeek?.id ?? null,
      generatedOn,
    })
    const pdf = await renderPlanPdf(html, `${clinicName} — Content Plan`)

    const slug =
      clinicName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'clinic'
    const filename = `content-plan-${slug}-${now.toISOString().slice(0, 10)}.pdf`

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'pdf render failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
