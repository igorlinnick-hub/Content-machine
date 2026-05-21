import { createServerClient } from '@/lib/supabase/server'
import type { Database, Json } from '@/types/supabase'

type ArsenalUpdate = Database['public']['Tables']['script_arsenal']['Update']

// Storage helpers for video ingest queue + script_arsenal. Used by
// the TG webhook (URL detection → enqueue), the API endpoints the
// local Claude Code skill calls, the Archy handoff (list/toggle), and
// brief.ts (inject active styles into Writer context).

export type IngestPlatform =
  | 'instagram'
  | 'youtube'
  | 'tiktok'
  | 'twitter'
  | 'unknown'

export type IngestStatus =
  | 'pending'
  | 'processing'
  | 'awaiting_confirm'
  | 'completed'
  | 'failed'
  | 'skipped'

// Loose shapes for the JSON columns. The extractor (local skill) is
// authoritative — we keep these wide so a future schema tweak doesn't
// require a migration.
export interface ArsenalHook {
  text: string
  position_sec?: number | null
  why_it_works?: string | null
}

export interface ArsenalBeat {
  name: string
  text: string
  sec?: number | null
}

export interface ArsenalStructure {
  beats?: ArsenalBeat[]
  // Free-form notes the extractor leaves for the Writer (e.g.
  // "uses two-line punch + question format").
  notes?: string
}

// Output of the in-skill multimodal visual pass. Wide-open shape so
// the prompt can evolve without a migration.
export interface ArsenalStoryboardFrame {
  sec?: number | null
  description: string
  broll_type?: string | null
}

export interface ArsenalVisualNotes {
  storyboard?: ArsenalStoryboardFrame[]
  pacing?: string | null
  broll_pattern?: string | null
  hook_visual?: string | null
}

// Append-only changelog entry. We keep enough to render a small UI
// history block ("3 changes — last: разверни про b-roll") without
// having to diff JSON columns.
export interface ArsenalRefineEntry {
  at: string
  note: string
  summary?: string | null
}

export interface ArsenalRow {
  id: string
  clinic_id: string
  queue_id: string | null
  source_url: string | null
  source_platform: string | null
  style_label: string
  style_description: string | null
  title: string | null
  full_transcript: string | null
  hooks: ArsenalHook[]
  structure: ArsenalStructure
  pains: string[]
  tags: string[]
  is_active: boolean
  confirmed_at: string | null
  created_at: string
  visual_notes: ArsenalVisualNotes
  video_storage_path: string | null
  thumbnail_storage_path: string | null
  pending_refine_note: string | null
  refined_at: string | null
  refine_history: ArsenalRefineEntry[]
}

export interface QueueRow {
  id: string
  clinic_id: string
  source_url: string
  source_platform: string
  requested_by_chat_id: string | null
  requested_by_name: string | null
  status: string
  arsenal_id: string | null
  error: string | null
  created_at: string
  processed_at: string | null
}

const PLATFORM_PATTERNS: Array<{ host: RegExp; platform: IngestPlatform }> = [
  { host: /(^|\.)instagram\.com$/i, platform: 'instagram' },
  { host: /(^|\.)youtube\.com$/i, platform: 'youtube' },
  { host: /(^|\.)youtu\.be$/i, platform: 'youtube' },
  { host: /(^|\.)tiktok\.com$/i, platform: 'tiktok' },
  { host: /(^|\.)twitter\.com$/i, platform: 'twitter' },
  { host: /(^|\.)x\.com$/i, platform: 'twitter' },
]

// Extracts the first ingest-able URL from free-form TG text. Returns
// null when no http(s) URL points at a known video host. The doctor
// can paste extra commentary around the link — we still find it.
export function detectIngestUrl(
  text: string
): { url: string; platform: IngestPlatform } | null {
  const matches = text.match(/https?:\/\/[^\s)]+/g)
  if (!matches) return null
  for (const raw of matches) {
    const cleaned = raw.replace(/[).,!?]+$/, '')
    try {
      const u = new URL(cleaned)
      for (const p of PLATFORM_PATTERNS) {
        if (p.host.test(u.hostname)) {
          return { url: cleaned, platform: p.platform }
        }
      }
    } catch {
      continue
    }
  }
  return null
}

export async function enqueueIngest(params: {
  clinicId: string
  sourceUrl: string
  platform: IngestPlatform
  requestedByChatId?: string | null
  requestedByName?: string | null
}): Promise<{ row: QueueRow; reused: boolean }> {
  const supabase = createServerClient()
  // Use upsert on (clinic_id, source_url) so a doctor pasting the same
  // link twice doesn't create duplicate work. If the previous row is
  // still pending / awaiting_confirm we treat it as "reused"; if it
  // already completed we surface that too.
  const { data: existing } = await supabase
    .from('video_ingest_queue')
    .select('*')
    .eq('clinic_id', params.clinicId)
    .eq('source_url', params.sourceUrl)
    .maybeSingle()

  if (existing) {
    return { row: existing as QueueRow, reused: true }
  }

  const { data, error } = await supabase
    .from('video_ingest_queue')
    .insert({
      clinic_id: params.clinicId,
      source_url: params.sourceUrl,
      source_platform: params.platform,
      requested_by_chat_id: params.requestedByChatId ?? null,
      requested_by_name: params.requestedByName ?? null,
      status: 'pending',
    })
    .select('*')
    .single()
  if (error || !data) {
    throw new Error(`enqueueIngest failed: ${error?.message ?? 'unknown'}`)
  }
  return { row: data as QueueRow, reused: false }
}

export async function loadPendingIngests(limit = 10): Promise<QueueRow[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('video_ingest_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as QueueRow[]
}

// Used by Archy's list view so the doctor sees URLs that arrived but
// haven't been extracted yet — otherwise a pasted link looks "lost"
// until the skill runs. We surface pending + processing + failed; the
// completed ones already have an arsenal row that shows in loadArsenal.
export async function loadUnresolvedIngests(
  clinicId: string,
  limit = 10
): Promise<QueueRow[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('video_ingest_queue')
    .select('*')
    .eq('clinic_id', clinicId)
    .in('status', ['pending', 'processing', 'failed'])
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as QueueRow[]
}

export async function markIngestProcessing(queueId: string): Promise<void> {
  const supabase = createServerClient()
  await supabase
    .from('video_ingest_queue')
    .update({ status: 'processing' })
    .eq('id', queueId)
}

export async function markIngestFailed(
  queueId: string,
  error: string
): Promise<void> {
  const supabase = createServerClient()
  await supabase
    .from('video_ingest_queue')
    .update({
      status: 'failed',
      error: error.slice(0, 400),
      processed_at: new Date().toISOString(),
    })
    .eq('id', queueId)
}

// Called by the local skill once extraction is done. Creates a
// script_arsenal row with is_active=false (awaiting doctor confirm),
// pivots the queue row to awaiting_confirm, and pins the arsenal_id.
export async function createArsenalDraft(params: {
  queueId: string
  clinicId: string
  styleLabel: string
  styleDescription?: string | null
  title?: string | null
  fullTranscript?: string | null
  hooks?: ArsenalHook[]
  structure?: ArsenalStructure
  pains?: string[]
  tags?: string[]
  sourceUrl?: string | null
  sourcePlatform?: string | null
}): Promise<ArsenalRow> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('script_arsenal')
    .insert({
      clinic_id: params.clinicId,
      queue_id: params.queueId,
      source_url: params.sourceUrl ?? null,
      source_platform: params.sourcePlatform ?? null,
      style_label: params.styleLabel,
      style_description: params.styleDescription ?? null,
      title: params.title ?? null,
      full_transcript: params.fullTranscript ?? null,
      hooks: (params.hooks ?? []) as unknown as Json,
      structure: (params.structure ?? {}) as unknown as Json,
      pains: (params.pains ?? []) as unknown as Json,
      tags: params.tags ?? [],
      is_active: false,
    })
    .select('*')
    .single()
  if (error || !data) {
    throw new Error(`createArsenalDraft failed: ${error?.message ?? 'unknown'}`)
  }

  await supabase
    .from('video_ingest_queue')
    .update({
      status: 'awaiting_confirm',
      arsenal_id: data.id,
      processed_at: new Date().toISOString(),
    })
    .eq('id', params.queueId)

  return data as unknown as ArsenalRow
}

// Doctor confirmed → flip the draft to active, mark the queue
// completed, AND mirror the structure into script_templates so the
// writer can pick it up both as a style reference (arsenal brief) and
// as a scaffold (templates pool). The template mirror is best-effort
// — a failure there does not undo the confirm. Returns the updated row.
export async function confirmArsenalRow(
  arsenalId: string,
  clinicId: string
): Promise<ArsenalRow | null> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('script_arsenal')
    .update({ is_active: true, confirmed_at: new Date().toISOString() })
    .eq('id', arsenalId)
    .eq('clinic_id', clinicId)
    .select('*')
    .single()
  if (error || !data) return null
  await supabase
    .from('video_ingest_queue')
    .update({ status: 'completed', processed_at: new Date().toISOString() })
    .eq('arsenal_id', arsenalId)

  // Best-effort template mirror. Dynamic import to break a potential
  // circular dependency with lib/posts/templates (which lives next to
  // writer code that may import arsenal types in the future).
  try {
    const { saveArsenalAsTemplate } = await import('./template-bridge')
    await saveArsenalAsTemplate(data as unknown as ArsenalRow)
  } catch {
    // swallow — user can still click "Save as template" manually
  }

  return data as unknown as ArsenalRow
}

// Soft toggle. Doctor says "style X off" — row stays, Writer stops
// seeing it. Calling again with the opposite value re-enables.
export async function setArsenalActive(
  arsenalId: string,
  clinicId: string,
  isActive: boolean
): Promise<ArsenalRow | null> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('script_arsenal')
    .update({ is_active: isActive })
    .eq('id', arsenalId)
    .eq('clinic_id', clinicId)
    .select('*')
    .single()
  if (error || !data) return null
  return data as unknown as ArsenalRow
}

// Hard delete. Used when doctor says "drop style X" — the row goes
// away. The matching queue row stays (so we don't re-ingest the same
// URL by accident).
export async function deleteArsenalRow(
  arsenalId: string,
  clinicId: string
): Promise<boolean> {
  const supabase = createServerClient()
  const { error } = await supabase
    .from('script_arsenal')
    .delete()
    .eq('id', arsenalId)
    .eq('clinic_id', clinicId)
  return !error
}

export async function loadArsenal(
  clinicId: string,
  opts: { onlyActive?: boolean; limit?: number } = {}
): Promise<ArsenalRow[]> {
  const supabase = createServerClient()
  let q = supabase
    .from('script_arsenal')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 25)
  if (opts.onlyActive) q = q.eq('is_active', true)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as ArsenalRow[]
}

export async function findArsenalByLabel(
  clinicId: string,
  label: string
): Promise<ArsenalRow | null> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('script_arsenal')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('style_label', label)
    .maybeSingle()
  return data as unknown as ArsenalRow | null
}

// Single-row read for the back-office detail view + refinement
// pipeline. Clinic-scoped so the admin cookie still can't poke other
// clinics' rows even if it knows the uuid.
export async function loadArsenalRow(
  arsenalId: string,
  clinicId: string
): Promise<ArsenalRow | null> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('script_arsenal')
    .select('*')
    .eq('id', arsenalId)
    .eq('clinic_id', clinicId)
    .maybeSingle()
  return data as unknown as ArsenalRow | null
}

// Admin types a free-form refinement note ("разверни про b-roll
// подробнее"). We persist it and the skill polls /api/arsenal/refine-queue
// to pick it up. Setting it again before the skill consumes the
// previous note overwrites — that's the operator's intent (latest note
// wins).
export async function setPendingRefineNote(
  arsenalId: string,
  clinicId: string,
  note: string
): Promise<ArsenalRow | null> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('script_arsenal')
    .update({ pending_refine_note: note })
    .eq('id', arsenalId)
    .eq('clinic_id', clinicId)
    .select('*')
    .maybeSingle()
  return data as unknown as ArsenalRow | null
}

// What the skill polls. Service-role bypasses RLS so we just filter
// on the column rather than juggling a per-clinic call. The skill
// then re-asserts clinic by reading row.clinic_id.
export async function loadRefineQueue(limit = 10): Promise<ArsenalRow[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('script_arsenal')
    .select('*')
    .not('pending_refine_note', 'is', null)
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as unknown as ArsenalRow[]
}

// The skill's refinement output. We merge the new fields, clear the
// pending note, stamp refined_at, and prepend to refine_history. Each
// field is optional — refinement might only update visual_notes if
// the operator asked specifically about b-rolls.
export interface ApplyRefinementInput {
  styleDescription?: string | null
  hooks?: ArsenalHook[]
  structure?: ArsenalStructure
  pains?: string[]
  visualNotes?: ArsenalVisualNotes
  summary?: string | null
}

export async function applyRefinement(
  arsenalId: string,
  clinicId: string,
  input: ApplyRefinementInput
): Promise<ArsenalRow | null> {
  const supabase = createServerClient()

  // Read first so we can append to refine_history and use the existing
  // pending_refine_note as the entry's `note`.
  const existing = await loadArsenalRow(arsenalId, clinicId)
  if (!existing) return null

  const newEntry: ArsenalRefineEntry = {
    at: new Date().toISOString(),
    note: existing.pending_refine_note ?? '(empty)',
    summary: input.summary ?? null,
  }
  const history = Array.isArray(existing.refine_history)
    ? [newEntry, ...existing.refine_history].slice(0, 20)
    : [newEntry]

  const patch: ArsenalUpdate = {
    pending_refine_note: null,
    refined_at: new Date().toISOString(),
    refine_history: history as unknown as Json,
  }
  if (input.styleDescription !== undefined)
    patch.style_description = input.styleDescription
  if (input.hooks !== undefined)
    patch.hooks = input.hooks as unknown as Json
  if (input.structure !== undefined)
    patch.structure = input.structure as unknown as Json
  if (input.pains !== undefined)
    patch.pains = input.pains as unknown as Json
  if (input.visualNotes !== undefined)
    patch.visual_notes = input.visualNotes as unknown as Json

  const { data } = await supabase
    .from('script_arsenal')
    .update(patch)
    .eq('id', arsenalId)
    .eq('clinic_id', clinicId)
    .select('*')
    .maybeSingle()
  return data as unknown as ArsenalRow | null
}

// Skill calls this once it has uploaded the mp4 + thumbnail. Stored
// as the bucket key (not the public URL) so we can move the bucket
// or sign URLs later without a data migration.
export async function setVideoStorage(
  arsenalId: string,
  clinicId: string,
  videoPath: string | null,
  thumbnailPath: string | null
): Promise<void> {
  const supabase = createServerClient()
  await supabase
    .from('script_arsenal')
    .update({
      video_storage_path: videoPath,
      thumbnail_storage_path: thumbnailPath,
    })
    .eq('id', arsenalId)
    .eq('clinic_id', clinicId)
}

// Visual-pass-only update, used when the skill ran visual extraction
// out-of-band of the original draft creation.
export async function setVisualNotes(
  arsenalId: string,
  clinicId: string,
  visualNotes: ArsenalVisualNotes
): Promise<void> {
  const supabase = createServerClient()
  await supabase
    .from('script_arsenal')
    .update({ visual_notes: visualNotes as unknown as Json })
    .eq('id', arsenalId)
    .eq('clinic_id', clinicId)
}
