import { getDriveClient } from './drive'
import { createServerClient } from '@/lib/supabase/server'

// Per-clinic Drive workspace (HANDOFF §22.2 п.7). On clinic creation
// we provision:
//   {GOOGLE_DRIVE_CLINICS_ROOT_ID}/
//     {Clinic Name — Doctor}/
//       Inbox/      <- doctor drops raw videos here
//       Originals/  <- source files parked here after processing
//       Finals/     <- per-clip folders with cleaned.mp4 + transcripts
//
// Folder ids live on the clinics row. NULL columns = legacy global
// env folders (GOOGLE_DRIVE_CLIPS_INBOX_ID / _CLEANED_ID) — HWC keeps
// working untouched until provisioned. Same white-label rule as
// everywhere: the clinic connects nothing, our team shares their
// folder with them.

export interface ClinicDriveFolders {
  rootId: string
  inboxId: string
  originalsId: string
  finalsId: string
}

async function createDriveFolder(
  name: string,
  parentId: string
): Promise<string> {
  const drive = getDriveClient()
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
    supportsAllDrives: true,
  })
  if (!res.data.id) throw new Error(`createDriveFolder(${name}): no id returned`)
  return res.data.id
}

// Create the clinic's folder tree and persist ids on the clinics row.
// Idempotent: if the row already has all four ids, returns them as-is.
// Returns null when GOOGLE_DRIVE_CLINICS_ROOT_ID is not set — the
// caller treats that as "legacy env folders stay in charge".
export async function provisionClinicDriveFolders(params: {
  clinicId: string
  clinicName: string
  doctorName?: string | null
}): Promise<ClinicDriveFolders | null> {
  const parentId = process.env.GOOGLE_DRIVE_CLINICS_ROOT_ID
  if (!parentId) return null

  const existing = await getClinicDriveFolders(params.clinicId)
  if (existing) return existing

  const folderName = params.doctorName
    ? `${params.clinicName} — ${params.doctorName}`
    : params.clinicName
  const rootId = await createDriveFolder(folderName, parentId)
  const [inboxId, originalsId, finalsId] = await Promise.all([
    createDriveFolder('Inbox', rootId),
    createDriveFolder('Originals', rootId),
    createDriveFolder('Finals', rootId),
  ])

  const supabase = createServerClient()
  const { error } = await supabase
    .from('clinics')
    .update({
      drive_root_folder_id: rootId,
      drive_inbox_folder_id: inboxId,
      drive_originals_folder_id: originalsId,
      drive_finals_folder_id: finalsId,
    })
    .eq('id', params.clinicId)
  if (error) throw error

  return { rootId, inboxId, originalsId, finalsId }
}

export async function getClinicDriveFolders(
  clinicId: string
): Promise<ClinicDriveFolders | null> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('clinics')
    .select(
      'drive_root_folder_id, drive_inbox_folder_id, drive_originals_folder_id, drive_finals_folder_id'
    )
    .eq('id', clinicId)
    .maybeSingle()
  // Fail-soft: if migration 037 isn't applied yet the select errors —
  // treat as "not provisioned" so the pipeline falls back to the
  // legacy env folders instead of failing the clip.
  if (error) {
    console.warn(`clinicFolders: lookup failed (fallback to env) — ${error.message}`)
    return null
  }
  const row = data as {
    drive_root_folder_id: string | null
    drive_inbox_folder_id: string | null
    drive_originals_folder_id: string | null
    drive_finals_folder_id: string | null
  } | null
  if (
    !row?.drive_root_folder_id ||
    !row.drive_inbox_folder_id ||
    !row.drive_originals_folder_id ||
    !row.drive_finals_folder_id
  ) {
    return null
  }
  return {
    rootId: row.drive_root_folder_id,
    inboxId: row.drive_inbox_folder_id,
    originalsId: row.drive_originals_folder_id,
    finalsId: row.drive_finals_folder_id,
  }
}

// All clinics that have their own provisioned Inbox — the cron poller
// walks these in addition to the legacy global Inbox.
export async function listClinicsWithDriveInbox(): Promise<
  Array<{ clinicId: string; folders: ClinicDriveFolders }>
> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('clinics')
    .select(
      'id, drive_root_folder_id, drive_inbox_folder_id, drive_originals_folder_id, drive_finals_folder_id'
    )
    .not('drive_inbox_folder_id', 'is', null)
  // Fail-soft (same reason as getClinicDriveFolders): missing
  // migration = no provisioned clinics, cron walks the legacy inbox.
  if (error) {
    console.warn(`clinicFolders: list failed (fallback to legacy) — ${error.message}`)
    return []
  }
  const rows = (data ?? []) as Array<{
    id: string
    drive_root_folder_id: string | null
    drive_inbox_folder_id: string | null
    drive_originals_folder_id: string | null
    drive_finals_folder_id: string | null
  }>
  return rows
    .filter(
      (r) =>
        r.drive_root_folder_id &&
        r.drive_inbox_folder_id &&
        r.drive_originals_folder_id &&
        r.drive_finals_folder_id
    )
    .map((r) => ({
      clinicId: r.id,
      folders: {
        rootId: r.drive_root_folder_id as string,
        inboxId: r.drive_inbox_folder_id as string,
        originalsId: r.drive_originals_folder_id as string,
        finalsId: r.drive_finals_folder_id as string,
      },
    }))
}
