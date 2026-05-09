import { TEAM, type AgentPersona } from '../personas'
import { runMarekGeneratePost, runMarekRefinePost } from './marek'
import { runOpsDiag } from './ops'
import { runIrisResearch } from './iris'
import { runVexBilling } from './vex'
import { runTildaReRender } from './tilda'
import { runPaxClipClean, runPaxClipStatus } from './pax'
import {
  runVerifyClip,
  runVerifyPost,
  runVerifyRender,
} from './verify'
import { tgSend } from '../telegram'
import type { HandoffResult } from './types'

// Switchboard for real handoffs. Webhook hands off here once it has
// the router decision. Each handoff returns void OR a delegate
// request — when the latter, dispatcher fires the second handoff
// once (1-hop max, no recursion).
//
// New handoffs plug in as additional case branches. If a tool is
// router-approved but not yet implemented here, we log a polite
// "not wired yet" message so the operator gets a clear signal
// instead of silence.

export interface DispatchContext {
  clinicId: string
  chatId: number | string
  agent: AgentPersona
  userMessage: string
  userName?: string
}

interface DispatchParams {
  intent: string
  toolParams: Record<string, unknown>
  ctx: DispatchContext
}

async function runOne(params: DispatchParams): Promise<HandoffResult> {
  const { intent, toolParams, ctx } = params
  const baseCtx = {
    chatId: ctx.chatId,
    agentEmoji: ctx.agent.emoji,
    agentName: ctx.agent.name,
  }
  const withClinic = { ...baseCtx, clinicId: ctx.clinicId }

  switch (intent) {
    case 'generate_post': {
      const topic = String(toolParams.topic ?? '')
      const length = toolParams.length === 'long' ? 'long' : 'short'
      const note = toolParams.note ? String(toolParams.note) : undefined
      await runMarekGeneratePost({ topic, length, note }, withClinic)
      return
    }
    case 'refine_post':
    case 'refine_script': {
      const note = String(toolParams.note ?? toolParams.topic ?? '')
      const slide_set_id = toolParams.slide_set_id
        ? String(toolParams.slide_set_id)
        : undefined
      await runMarekRefinePost({ note, slide_set_id }, withClinic)
      return
    }
    case 're_render_slides': {
      const slide_set_id = toolParams.slide_set_id
        ? String(toolParams.slide_set_id)
        : undefined
      await runTildaReRender({ slide_set_id }, withClinic)
      return
    }
    case 'change_style': {
      const tweak = String(toolParams.tweak ?? '')
      await tgSend(
        ctx.chatId,
        `${ctx.agent.emoji} *${ctx.agent.name}*\n\nNoted: "${tweak}". Style edits land in the next pass — saving as a learning so it's applied when wired.`
      )
      return
    }
    case 'web_research': {
      const query = String(toolParams.query ?? ctx.userMessage)
      const max_sources =
        typeof toolParams.max_sources === 'number'
          ? toolParams.max_sources
          : undefined
      await runIrisResearch({ query, max_sources }, baseCtx)
      return
    }
    case 'billing_report': {
      const periodIn = toolParams.period
      const period =
        periodIn === 'today' || periodIn === 'week' || periodIn === 'month'
          ? periodIn
          : 'month'
      await runVexBilling({ period }, baseCtx)
      return
    }
    case 'diag':
    case 'daily_check': {
      await runOpsDiag(withClinic)
      return
    }
    case 'clip_clean': {
      await runPaxClipClean(withClinic)
      return
    }
    case 'clip_status': {
      await runPaxClipStatus(withClinic)
      return
    }
    case 'verify_post': {
      const slide_set_id = toolParams.slide_set_id
        ? String(toolParams.slide_set_id)
        : undefined
      return await runVerifyPost(withClinic, { slide_set_id })
    }
    case 'verify_clip': {
      return await runVerifyClip(withClinic)
    }
    case 'verify_render': {
      const slide_set_id = toolParams.slide_set_id
        ? String(toolParams.slide_set_id)
        : undefined
      return await runVerifyRender(withClinic, { slide_set_id })
    }
    default: {
      await tgSend(
        ctx.chatId,
        `${ctx.agent.emoji} *${ctx.agent.name}*\n\n_(intent ${intent} not wired yet)_`
      )
    }
  }
}

export async function dispatchHandoff(params: DispatchParams): Promise<void> {
  const result = await runOne(params)

  // 1-hop delegation. The handoff said "I need agent B to follow
  // up." We post a short reason line so the operator sees what's
  // happening, then run the delegated tool. Hard cap at one hop —
  // if B also returns a delegate, we ignore it (cuts runaway risk).
  if (result?.delegate) {
    const d = result.delegate
    const target =
      TEAM.find((a) => a.key === d.agentKey.toLowerCase()) ?? params.ctx.agent
    if (d.reason) {
      await tgSend(
        params.ctx.chatId,
        `↳ _${target.emoji} ${target.name} called in: ${d.reason}_`
      )
    }
    await runOne({
      intent: d.intent,
      toolParams: d.params ?? {},
      ctx: {
        ...params.ctx,
        agent: target,
      },
    })
  }
}
