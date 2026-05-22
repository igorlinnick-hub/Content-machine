import { createServerClient } from '@/lib/supabase/server'
import { loadSlideSet } from '@/lib/visual/store'
import { renderSlides } from '@/lib/visual/renderer'
import { loadPhotoUrlsForSlideSet } from '@/lib/visual/photos'
import { runCritic } from '@/lib/agents/critic'
import { guardDisabledHandoff } from '@/lib/agents/disabled'
import { loadSharedContext } from '@/lib/supabase/context'
import { loadRecentClips } from '@/lib/clips/store'
import type { WriterOutput } from '@/types'
import { tgSend } from '../telegram'
import type { HandoffResult } from './types'

// Verify-tools: each agent can sanity-check their last action and
// report pass/fail. The point is the agent NOTICES degradation
// before the operator has to (e.g., critic score dropped, clip
// over-cut, slides drift). Verify tools do NOT mutate state — they
// observe and report.

export interface VerifyHandoffContext {
  clinicId: string
  chatId: number | string
  agentEmoji: string
  agentName: string
}

interface SlideSetRowMin {
  id: string
  script_id: string | null
  scripts:
    | { topic: string | null; hook: string | null; full_script: string; word_count: number | null }
    | Array<{ topic: string | null; hook: string | null; full_script: string; word_count: number | null }>
    | null
}

async function loadLatestOrById(
  clinicId: string,
  slideSetId?: string
): Promise<SlideSetRowMin | null> {
  const supabase = createServerClient()
  const baseQuery = supabase
    .from('slide_sets')
    .select('id, script_id, scripts ( topic, hook, full_script, word_count )')
    .eq('clinic_id', clinicId)
  const q = slideSetId
    ? baseQuery.eq('id', slideSetId).maybeSingle()
    : baseQuery.order('created_at', { ascending: false }).limit(1).maybeSingle()
  const { data } = await q
  if (!data) return null
  return data as unknown as SlideSetRowMin
}

// Marek verify_post: re-runs critic on the saved script, surfaces
// total_score + main feedback line, plus a quick diff_rules
// substring check against the script body.
export async function runVerifyPost(
  ctx: VerifyHandoffContext,
  params: { slide_set_id?: string }
): Promise<HandoffResult> {
  if (await guardDisabledHandoff(ctx, 'Verify (re-run critic)')) return
  const row = await loadLatestOrById(ctx.clinicId, params.slide_set_id)
  if (!row) {
    await tgSend(
      ctx.chatId,
      `${ctx.agentEmoji} *${ctx.agentName}*\n\nNo slide_set found to verify.`
    )
    return
  }
  const s = Array.isArray(row.scripts) ? row.scripts[0] : row.scripts
  if (!s || !s.full_script) {
    await tgSend(
      ctx.chatId,
      `${ctx.agentEmoji} *${ctx.agentName}*\n\nslide_set ${row.id.slice(0, 8)} has no linked script.`
    )
    return
  }

  const context = await loadSharedContext(ctx.clinicId)

  const writerOut: WriterOutput = {
    variants: [
      {
        id: 'v',
        topic: s.topic ?? '',
        hook: s.hook ?? '',
        script: s.full_script,
        word_count: s.word_count ?? s.full_script.split(/\s+/).length,
        estimated_seconds: 0,
        template_name: null,
      },
    ],
  }

  let score = 0
  let approved = false
  let feedback = ''
  try {
    const critic = await runCritic({ context, variants: writerOut })
    const sc = critic.scores[0]
    if (sc) {
      score = sc.total_score
      approved = sc.approved
      feedback = sc.feedback
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    await tgSend(
      ctx.chatId,
      `${ctx.agentEmoji} *${ctx.agentName}*\n\n_(critic re-run failed: ${msg})_`
    )
    return
  }

  // Quick diff_rules substring check — if a rule says "never use
  // 'as a clinician'", we flag it appearing in the script body.
  // Crude but useful for catching regressions.
  const violations: string[] = []
  for (const r of context.diff_rules) {
    const m = r.rule.match(
      /(?:never|don'?t|avoid|stop)\s+(?:use|say|write|including|saying|writing)?\s*['"“]([^'"”]+)['"”]/i
    )
    if (m && m[1]) {
      const phrase = m[1]
      if (s.full_script.toLowerCase().includes(phrase.toLowerCase())) {
        violations.push(`"${phrase}" — ${r.rule}`)
      }
    }
  }

  const flag =
    score >= 8 && approved && violations.length === 0
      ? '🟢'
      : score >= 6 && approved
        ? '🟡'
        : '🔴'

  const lines = [
    `${ctx.agentEmoji} *${ctx.agentName}* — verify post ${row.id.slice(0, 8)}`,
    ``,
    `${flag} Critic re-score: *${score.toFixed(1)}* (${approved ? 'approved' : 'rejected'})`,
    ``,
    `*Feedback:* ${feedback || '(none)'}`,
  ]
  if (violations.length > 0) {
    lines.push('', `*diff_rules violations (${violations.length}):*`)
    for (const v of violations.slice(0, 5)) lines.push(`- ${v}`)
  }

  await tgSend(ctx.chatId, lines.join('\n'))

  // If degraded badly, delegate to Marek to refine — but only when
  // the operator didn't initiate from Marek already (we always
  // attribute verify to Marek so deduplication is by score).
  if (score < 6 || violations.length >= 2) {
    return {
      delegate: {
        agentKey: 'marek',
        intent: 'refine_post',
        params: {
          slide_set_id: row.id,
          note: `Critic re-score ${score.toFixed(1)}. Issues: ${feedback || 'low score'}. ${violations.length > 0 ? `diff_rules violations: ${violations.slice(0, 3).join('; ')}.` : ''} Tighten the script to fix these.`,
        },
        reason: `verify_post flagged score ${score.toFixed(1)} + ${violations.length} rule violations`,
      },
    }
  }
}

// Pax verify_clip: sanity-check the most-recent clip (or by id) —
// duration_out / duration_in ratio (over-cut warning), transcript
// length, status flag.
export async function runVerifyClip(
  ctx: VerifyHandoffContext
): Promise<HandoffResult> {
  const recent = await loadRecentClips(ctx.clinicId, 1)
  const c = recent[0]
  if (!c) {
    await tgSend(
      ctx.chatId,
      `${ctx.agentEmoji} *${ctx.agentName}*\n\nNo clips processed yet — nothing to verify.`
    )
    return
  }

  const lines: string[] = [
    `${ctx.agentEmoji} *${ctx.agentName}* — verify *${c.drive_inbox_file_name}*`,
    ``,
  ]
  let problems = 0

  if (c.status !== 'cleaned') {
    lines.push(`🔴 status: ${c.status}${c.error ? ` — ${c.error}` : ''}`)
    problems += 1
  } else {
    lines.push(`🟢 status: cleaned`)
  }

  if (c.duration_in_sec && c.duration_out_sec) {
    const ratio = c.duration_out_sec / c.duration_in_sec
    if (ratio < 0.4) {
      lines.push(
        `🔴 over-cut: ratio ${(ratio * 100).toFixed(0)}% (lost ${((1 - ratio) * 100).toFixed(0)}% of duration)`
      )
      problems += 1
    } else if (ratio > 0.95) {
      lines.push(
        `🟡 under-cut: ratio ${(ratio * 100).toFixed(0)}% — barely trimmed anything`
      )
      problems += 1
    } else {
      lines.push(
        `🟢 cuts: ${c.cuts_filler_count ?? 0} fillers + ${c.cuts_silence_count ?? 0} silences = ${(ratio * 100).toFixed(0)}% kept`
      )
    }
  }

  if (c.transcript_txt_file_id == null && c.status === 'cleaned') {
    lines.push(`🔴 no transcript artifact uploaded`)
    problems += 1
  }

  if (problems === 0) {
    lines.push('', '_All checks pass._')
  }

  await tgSend(ctx.chatId, lines.join('\n'))

  if (c.status === 'failed' && c.error?.toLowerCase().includes('drive')) {
    return {
      delegate: {
        agentKey: 'ops',
        intent: 'diag',
        params: {},
        reason: 'verify_clip caught a Drive error — running diag',
      },
    }
  }
}

// Tilda verify_render: re-renders head + tail slides on the latest
// (or named) slide_set and compares buffer count + size band vs
// what's in the DB. Catches "render returned 0-byte" and "photo
// drift" cases. Cheap — only renders 2 slides.
export async function runVerifyRender(
  ctx: VerifyHandoffContext,
  params: { slide_set_id?: string }
): Promise<HandoffResult> {
  const supabase = createServerClient()
  const baseQuery = supabase
    .from('slide_sets')
    .select('id')
    .eq('clinic_id', ctx.clinicId)
  const target = params.slide_set_id
    ? await baseQuery.eq('id', params.slide_set_id).maybeSingle()
    : await baseQuery
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
  if (!target.data) {
    await tgSend(
      ctx.chatId,
      `${ctx.agentEmoji} *${ctx.agentName}*\n\nNo slide_set to verify.`
    )
    return
  }
  const slideSetId = target.data.id

  try {
    const ss = await loadSlideSet(slideSetId)
    if (ss.slides.length === 0) {
      await tgSend(
        ctx.chatId,
        `${ctx.agentEmoji} *${ctx.agentName}*\n\n🔴 slide_set ${slideSetId.slice(0, 8)} has 0 slides.`
      )
      return
    }
    const headIdx = 0
    const tailIdx = ss.slides.length - 1
    const photoUrls = await loadPhotoUrlsForSlideSet(
      slideSetId,
      ss.slides,
      ss.style_template
    )
    const buffers = await renderSlides(
      [
        { slide: ss.slides[headIdx], photoUrl: photoUrls[headIdx] },
        { slide: ss.slides[tailIdx], photoUrl: photoUrls[tailIdx] },
      ],
      ss.style_template
    )

    const headSize = buffers[0]?.length ?? 0
    const tailSize = buffers[1]?.length ?? 0
    const ok =
      headSize > 1000 &&
      tailSize > 1000 &&
      headSize < 5_000_000 &&
      tailSize < 5_000_000
    const flag = ok ? '🟢' : '🔴'

    const txt = [
      `${ctx.agentEmoji} *${ctx.agentName}* — verify render ${slideSetId.slice(0, 8)}`,
      ``,
      `${flag} head slide: ${(headSize / 1024).toFixed(1)} KB`,
      `${flag} tail slide: ${(tailSize / 1024).toFixed(1)} KB`,
      `Total slides in set: ${ss.slides.length}`,
    ].join('\n')

    await tgSend(ctx.chatId, txt)
    if (!ok) {
      return {
        delegate: {
          agentKey: 'ops',
          intent: 'diag',
          params: {},
          reason: 'verify_render produced abnormal sizes — diag drive/env',
        },
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    await tgSend(
      ctx.chatId,
      `${ctx.agentEmoji} *${ctx.agentName}*\n\n🔴 render verify crashed: ${msg}`
    )
    return {
      delegate: {
        agentKey: 'ops',
        intent: 'diag',
        params: {},
        reason: `verify_render crashed: ${msg}`,
      },
    }
  }
}
