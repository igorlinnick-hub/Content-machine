import { tgSend } from '../telegram'
import { guardDisabledHandoff } from '@/lib/agents/disabled'

// Iris's web research handoff. Calls Perplexity Sonar if the key is
// set; otherwise acknowledges and asks the operator to add the key
// before any real lookup happens. Kept minimal — research output
// shape evolves once we wire it into post drafting.

export interface IrisResearchParams {
  query: string
  max_sources?: number
}

export interface IrisHandoffContext {
  chatId: number | string
  agentEmoji: string
  agentName: string
}

export async function runIrisResearch(
  params: IrisResearchParams,
  ctx: IrisHandoffContext
): Promise<void> {
  // Perplexity is a separately-billed paid API. Gate it behind the
  // same flag as Anthropic so "subscription-only mode" really means
  // zero pay-per-use across the board.
  if (await guardDisabledHandoff(ctx, 'Web research')) return
  const query = params.query.trim()
  if (!query) {
    await tgSend(
      ctx.chatId,
      `${ctx.agentEmoji} *${ctx.agentName}*\n\nGive me a question and I'll dig up sources.`
    )
    return
  }
  const apiKey = process.env.PERPLEXITY_API_KEY
  if (!apiKey) {
    await tgSend(
      ctx.chatId,
      `${ctx.agentEmoji} *${ctx.agentName}*\n\nWilling, but PERPLEXITY_API_KEY isn't in the env yet — once it's set, I'll run "${query}" with citations.`
    )
    return
  }

  try {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content:
              'You are a medical research assistant. Answer in 3-5 bullet points with inline citations. If a claim has no source, say so explicitly.',
          },
          { role: 'user', content: query },
        ],
        max_tokens: 600,
        return_citations: true,
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`sonar ${res.status}: ${body.slice(0, 200)}`)
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
      citations?: string[]
    }
    const content = data.choices?.[0]?.message?.content ?? '(no content)'
    const citations = (data.citations ?? []).slice(0, 5)
    const cited = citations.length
      ? `\n\nSources:\n${citations.map((c, i) => `${i + 1}. ${c}`).join('\n')}`
      : ''
    await tgSend(
      ctx.chatId,
      `${ctx.agentEmoji} *${ctx.agentName}*\n\n${content}${cited}`,
      { disablePreview: true }
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    await tgSend(
      ctx.chatId,
      `${ctx.agentEmoji} *${ctx.agentName}*\n\n_(sonar failed: ${msg})_`
    )
  }
}
