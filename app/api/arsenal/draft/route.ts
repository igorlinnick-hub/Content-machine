import { NextResponse } from 'next/server'
import {
  createArsenalDraft,
  setVideoStorage,
  setVisualNotes,
  type ArsenalHook,
  type ArsenalStructure,
  type ArsenalVisualNotes,
} from '@/lib/arsenal/store'
import { tgSend } from '@/lib/team/telegram'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

// POSTed by the local Claude Code skill after it transcribes + extracts
// from a single queue row. Creates a script_arsenal draft (is_active=false),
// flips the queue row to awaiting_confirm, and pings the doctor in TG
// with the extracted summary so they can confirm or drop.

function checkSecret(req: Request): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!expected) return true
  return req.headers.get('x-internal-dispatch-secret') === expected
}

interface DraftBody {
  queue_id: string
  clinic_id: string
  style_label: string
  style_description?: string | null
  title?: string | null
  full_transcript?: string | null
  hooks?: ArsenalHook[]
  structure?: ArsenalStructure
  pains?: string[]
  tags?: string[]
  source_url?: string | null
  source_platform?: string | null
  // The TG chat we should ping with the summary. The skill copies
  // this from the queue row's requested_by_chat_id. Null when the
  // ingest came from the web (admin UI) — UI polls /api/arsenal/[id]
  // to detect the new row instead.
  notify_chat_id?: string | null
  // Visual analysis + storage paths come from phases 4.5 / 4.6 of the
  // local skill. All optional — a draft posted without them works,
  // the visual block in the UI just renders empty.
  visual_notes?: ArsenalVisualNotes
  video_storage_path?: string | null
  thumbnail_storage_path?: string | null
  // Clinic-tailored template proposal — skill writes this when the
  // queue row's intent was 'template_for_clinic'. Plain text scaffold
  // (bracketed beats) that can be mirrored straight into
  // script_templates.scaffold on confirm.
  clinic_template_proposal?: string | null
  clinic_template_note?: string | null
}

function fmtHooks(hooks: ArsenalHook[] | undefined): string {
  if (!hooks || hooks.length === 0) return '_(no hooks extracted)_'
  return hooks
    .slice(0, 5)
    .map((h, i) => `${i + 1}. "${h.text}"`)
    .join('\n')
}

function fmtBeats(structure: ArsenalStructure | undefined): string {
  const beats = structure?.beats ?? []
  if (beats.length === 0) return '_(no structure extracted)_'
  return beats
    .map((b) => `• *${b.name}* — ${b.text.slice(0, 100)}`)
    .join('\n')
}

export async function POST(req: Request) {
  if (!checkSecret(req)) {
    return NextResponse.json({ error: 'invalid secret' }, { status: 401 })
  }
  let body: DraftBody
  try {
    body = (await req.json()) as DraftBody
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  if (!body.queue_id || !body.clinic_id || !body.style_label) {
    return NextResponse.json(
      { error: 'queue_id, clinic_id, style_label required' },
      { status: 400 }
    )
  }

  let row
  try {
    row = await createArsenalDraft({
      queueId: body.queue_id,
      clinicId: body.clinic_id,
      styleLabel: body.style_label,
      styleDescription: body.style_description ?? null,
      title: body.title ?? null,
      fullTranscript: body.full_transcript ?? null,
      hooks: body.hooks ?? [],
      structure: body.structure ?? {},
      pains: body.pains ?? [],
      tags: body.tags ?? [],
      sourceUrl: body.source_url ?? null,
      sourcePlatform: body.source_platform ?? null,
      clinicTemplateProposal: body.clinic_template_proposal ?? null,
      clinicTemplateNote: body.clinic_template_note ?? null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }

  // Visual notes + storage paths are written as follow-up updates so
  // createArsenalDraft's strict-required-fields signature stays
  // backwards compatible. Failures here don't void the draft — the
  // operator can re-trigger the visual phase via refine later.
  if (body.visual_notes) {
    await setVisualNotes(row.id, body.clinic_id, body.visual_notes).catch(
      () => {}
    )
  }
  if (body.video_storage_path || body.thumbnail_storage_path) {
    await setVideoStorage(
      row.id,
      body.clinic_id,
      body.video_storage_path ?? null,
      body.thumbnail_storage_path ?? null
    ).catch(() => {})
  }

  // Ping the doctor with the extraction summary. Fire-and-forget —
  // the skill doesn't block on TG delivery.
  if (body.notify_chat_id) {
    const proposalBlock =
      body.clinic_template_proposal && body.clinic_template_proposal.trim()
        ? [
            '',
            '*Темплейт под нашу клинику* 🧱',
            body.clinic_template_note ? `_${body.clinic_template_note}_` : '',
            '```',
            body.clinic_template_proposal.trim().slice(0, 900),
            '```',
            'Сохраню в Templates на вебапе при подтверждении.',
          ]
            .filter((line) => line !== '')
            .join('\n')
        : ''
    const text = [
      `📚 *Archy* — стиль *\`${row.style_label}\`* готов к подтверждению`,
      '',
      row.style_description ? `_${row.style_description}_` : '',
      '',
      `*Структура*`,
      fmtBeats(body.structure),
      '',
      `*Хуки*`,
      fmtHooks(body.hooks),
      '',
      body.pains && body.pains.length
        ? `*Боли:* ${body.pains.slice(0, 5).join(', ')}`
        : '',
      proposalBlock,
      '',
      `Сохранить → *"arsenal confirm ${row.style_label}"*`,
      `Удалить → *"arsenal drop ${row.style_label}"*`,
    ]
      .filter((line) => line !== '')
      .join('\n')
    void tgSend(body.notify_chat_id, text).catch(() => {})
  }

  return NextResponse.json({ ok: true, arsenal_id: row.id })
}
