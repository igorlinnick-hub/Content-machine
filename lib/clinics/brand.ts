import { randomBytes } from 'crypto'
import { createServerClient } from '@/lib/supabase/server'

const BUCKET = 'clinic-logos'

export interface UploadInput {
  bytes: Uint8Array
  contentType: string
  ext: string
}

export async function uploadClinicLogo(
  clinicId: string,
  file: UploadInput
): Promise<string> {
  const supabase = createServerClient()
  // Versioned filename so the public URL changes on every replace —
  // Supabase / browsers / Puppeteer can't serve a stale logo.
  const version = randomBytes(4).toString('hex')
  const path = `${clinicId}/${version}.${file.ext}`

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file.bytes, {
      contentType: file.contentType,
      upsert: true,
    })
  if (uploadErr) throw uploadErr

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path)

  const { error: updateErr } = await supabase
    .from('clinics')
    .update({ logo_url: publicUrl })
    .eq('id', clinicId)
  if (updateErr) throw updateErr

  return publicUrl
}

export async function clearClinicLogo(clinicId: string): Promise<void> {
  const supabase = createServerClient()
  const { error } = await supabase
    .from('clinics')
    .update({ logo_url: null })
    .eq('id', clinicId)
  if (error) throw error
  // Old files are left orphaned in the bucket — versioned paths so they
  // never collide. A periodic cleanup job can sweep them later.
}

export async function getClinicLogo(clinicId: string): Promise<string | null> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('clinics')
    .select('logo_url')
    .eq('id', clinicId)
    .maybeSingle()
  return (data?.logo_url as string | null) ?? null
}
