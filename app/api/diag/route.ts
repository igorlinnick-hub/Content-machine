import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { getPhotosFromFolder, getPhotoDataUrl } from '@/lib/google/drive'
import { loadCategories } from '@/lib/posts/categories'
import { createServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Admin-only diagnostic endpoint. Pings every external dependency and
// returns a green/red report. The point is: when the post pipeline
// fails, the user can hit /api/diag and instantly see which subsystem
// is broken without me having to read Vercel logs.
export async function GET(req: Request) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }
  const url = new URL(req.url)
  const clinicId = url.searchParams.get('clinicId')

  const out: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      GOOGLE_SERVICE_ACCOUNT_EMAIL: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      GOOGLE_PRIVATE_KEY: !!process.env.GOOGLE_PRIVATE_KEY,
      GOOGLE_DRIVE_FOLDER_ID: !!process.env.GOOGLE_DRIVE_FOLDER_ID,
    },
  }

  // Supabase ping.
  try {
    const supabase = createServerClient()
    const { count, error } = await supabase
      .from('clinics')
      .select('id', { count: 'exact', head: true })
    out.supabase = error
      ? { ok: false, error: error.message }
      : { ok: true, clinic_count: count ?? 0 }
  } catch (e) {
    out.supabase = { ok: false, error: e instanceof Error ? e.message : 'unknown' }
  }

  // Drive ping per category folder.
  if (clinicId) {
    try {
      const cats = await loadCategories(clinicId)
      const driveResults: Array<{
        slug: string
        folder: string | null
        ok: boolean
        photo_count: number
        first_id: string | null
        first_data_url_ok: boolean
        error: string | null
      }> = []

      for (const c of cats) {
        const folder = c.drive_folder_id
        if (!folder) {
          driveResults.push({
            slug: c.slug,
            folder: null,
            ok: false,
            photo_count: 0,
            first_id: null,
            first_data_url_ok: false,
            error: 'drive_folder_id is null',
          })
          continue
        }
        try {
          const photos = await getPhotosFromFolder(folder)
          if (photos.length === 0) {
            driveResults.push({
              slug: c.slug,
              folder,
              ok: false,
              photo_count: 0,
              first_id: null,
              first_data_url_ok: false,
              error: 'folder has 0 images',
            })
            continue
          }
          // Try fetching first photo as data URL.
          const dataUrl = await getPhotoDataUrl(photos[0].id)
          driveResults.push({
            slug: c.slug,
            folder,
            ok: dataUrl !== null,
            photo_count: photos.length,
            first_id: photos[0].id,
            first_data_url_ok: dataUrl !== null,
            error: dataUrl ? null : 'getPhotoDataUrl returned null',
          })
        } catch (e) {
          driveResults.push({
            slug: c.slug,
            folder,
            ok: false,
            photo_count: 0,
            first_id: null,
            first_data_url_ok: false,
            error: e instanceof Error ? e.message : 'unknown error',
          })
        }
      }

      out.drive = driveResults
    } catch (e) {
      out.drive = { ok: false, error: e instanceof Error ? e.message : 'unknown' }
    }
  } else {
    out.drive = { skipped: 'pass ?clinicId=... to test Drive per category' }
  }

  // slide_sets query — pass ?slideSets=true to see the 20 most recent.
  if (url.searchParams.get('slideSets') === 'true' && clinicId) {
    try {
      const supabase = createServerClient()
      const { data, error } = await supabase
        .from('slide_sets')
        .select('id, clinic_id, script_id, created_at, render_result')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) {
        out.slide_sets = { ok: false, error: error.message }
      } else {
        out.slide_sets = {
          ok: true,
          count: data?.length ?? 0,
          rows: (data ?? []).map((r) => ({
            id: r.id,
            clinic_id: r.clinic_id,
            script_id: r.script_id,
            created_at: r.created_at,
            has_render: !!(r.render_result as Record<string,unknown>)?.slides,
            canva_design_id: (r.render_result as Record<string,unknown>)?.canva_design_id ?? null,
          })),
        }
      }
      // Also count all slide_sets for this clinic regardless of script_id.
      const { count: total } = await supabase
        .from('slide_sets')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', clinicId)
      out.slide_sets_total = total ?? 0
    } catch (e) {
      out.slide_sets = { ok: false, error: e instanceof Error ? e.message : 'unknown' }
    }
  }

  return NextResponse.json(out)
}
