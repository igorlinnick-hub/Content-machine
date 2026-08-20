import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { disabledHttpResponse } from '@/lib/agents/disabled'
import { addStudioVideoByEmbed, addStudioVideoByUrl } from '@/lib/studio/addByUrl'
import { loadStudioVideo, type ShotType } from '@/lib/studio/videos'
import { generateAndPinIdea, type StudioIdea } from '@/lib/studio/slots'
import { scheduleStudioVideo } from '@/lib/studio/schedule'
import { parseEmbed } from '@/lib/studio/embed'

export const runtime = 'nodejs'
export const maxDuration = 180

// POST /api/studio/videos/add  — ADMIN only.
//   { clinicId?, url, note?, shotType?, schedule?, shootDate? }
//
// Paste a reel link → it lands on the Shot List with a generated shoot brief.
// TikTok goes through Apify (real cover-frame analysis + a stored mp4);
// Instagram and YouTube take the embed path — nothing downloaded, the
// official player carries it, and `note` is the one line the admin types
// instead of writing the brief by hand.
//
// With schedule:true the video also takes the next open day, which is the
// whole "one video a day for the MAs" flow in a single call.
export async function POST(req: Request) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin')
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })

  const body = (await req.json().catch(() => ({}))) as {
    clinicId?: string
    url?: string
    note?: string
    shotType?: ShotType
    schedule?: boolean
    shootDate?: string
  }
  const clinicId = body.clinicId
  const url = body.url?.trim()
  if (!clinicId || !url)
    return NextResponse.json({ error: 'clinicId and url required' }, { status: 400 })

  const parsed = parseEmbed(url)
  if (!parsed)
    return NextResponse.json(
      { ok: false, error: 'Paste an Instagram reel, TikTok or YouTube link.' },
      { status: 400 }
    )

  // The embed path has no cover frame to analyse, so the note is the only
  // input describing the format. Without it the brief silently ignores the
  // reel. TikTok is exempt — Apify hands us a real cover to read.
  if (parsed.platform !== 'tiktok' && !body.note?.trim())
    return NextResponse.json(
      { ok: false, error: 'Add the one-line note — the brief is built from it.' },
      { status: 400 }
    )

  let added: { id: string }
  try {
    added =
      parsed.platform === 'tiktok'
        ? await addStudioVideoByUrl({ clinicId, url, status: 'shotlist' })
        : await addStudioVideoByEmbed({
            clinicId,
            url,
            note: body.note ?? null,
            shotType: body.shotType,
            status: 'shotlist',
          })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json({ ok: false, error: msg }, { status: 400 })
  }

  // Best-effort idea generation (respects the kill switch). The video is
  // already on the Shot List even if generation is off.
  const off = await disabledHttpResponse()
  let idea: StudioIdea | null = null
  if (!off) {
    try {
      const video = await loadStudioVideo(added.id, clinicId)
      if (video) idea = await generateAndPinIdea(clinicId, video)
    } catch {
      /* video is on the board; idea can be generated from the card later */
    }
  }

  // Scheduling comes last so a booked-day clash never loses the ingest.
  //
  // A brief the compliance gate blocked is NOT scheduled: the MA board drops
  // blocked cards, so booking a day for one would silently burn that day and
  // show the MAs an empty board. The video still lands on the Shot List with
  // its verdict, where the admin can regenerate and then schedule.
  let shootDate: string | null = null
  let scheduleError: string | null = null
  const blocked = idea ? idea.blocked : false
  if (body.schedule && blocked) {
    scheduleError =
      `Compliance returned ${idea?.compliance?.grade ?? 'no verdict'} — not scheduled. ` +
      'Regenerate the brief from the Shot List, then give it a day.'
  } else if (body.schedule) {
    try {
      const r = await scheduleStudioVideo(added.id, clinicId, body.shootDate ?? null)
      shootDate = r.shootDate
    } catch (e) {
      scheduleError = e instanceof Error ? e.message : 'could not schedule'
    }
  }

  return NextResponse.json({
    ok: true,
    id: added.id,
    shootDate,
    scheduleError,
    compliance: idea?.compliance ?? null,
    blocked,
  })
}
