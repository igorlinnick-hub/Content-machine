import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { disabledHttpResponse } from '@/lib/agents/disabled'
import { loadArsenalRow } from '@/lib/arsenal/store'
import {
  loadSlotRows,
  hydrateColumn,
  generateIdeaForArsenal,
  setSlotScript,
} from '@/lib/studio/slots'

export const runtime = 'nodejs'
export const maxDuration = 120

// POST /api/studio/slots/<index>/regenerate-idea
// Same video, fresh idea. Excludes the current hook so the Writer
// diverges. Doctor + admin (doctor pinned to own clinic).
export async function POST(
  req: Request,
  { params }: { params: { index: string } }
) {
  const access = await resolveAccess()
  if (!access) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const off = await disabledHttpResponse()
  if (off) return off

  let clinicId: string
  if (access.role === 'admin') {
    const body = (await req.json().catch(() => ({}))) as { clinicId?: string }
    if (!body.clinicId)
      return NextResponse.json({ error: 'clinicId required' }, { status: 400 })
    clinicId = body.clinicId
  } else {
    clinicId = access.clinicId
  }

  const slotIndex = Number.parseInt(params.index, 10)
  if (Number.isNaN(slotIndex))
    return NextResponse.json({ error: 'bad slot index' }, { status: 400 })

  const slot = (await loadSlotRows(clinicId)).find((s) => s.slot_index === slotIndex)
  if (!slot || !slot.arsenal_id)
    return NextResponse.json({ error: 'slot has no video' }, { status: 404 })

  const arsenal = await loadArsenalRow(slot.arsenal_id, clinicId)
  if (!arsenal)
    return NextResponse.json({ error: 'arsenal video not found' }, { status: 404 })

  // Steer the new idea away from the current hook.
  const before = await hydrateColumn(clinicId, slot)
  const excludeHooks = before.idea?.hook ? [before.idea.hook] : []

  try {
    const idea = await generateIdeaForArsenal(clinicId, arsenal, { excludeHooks })
    await setSlotScript(clinicId, slotIndex, idea.script_id)
    const column = await hydrateColumn(
      clinicId,
      { ...slot, current_script_id: idea.script_id },
      idea
    )
    return NextResponse.json({ ok: true, column })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
