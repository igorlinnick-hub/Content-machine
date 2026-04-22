import Anthropic from '@anthropic-ai/sdk'
import type { ToolUnion, WebSearchTool20260209 } from '@anthropic-ai/sdk/resources/messages'

export const MODEL_DEFAULT = 'claude-sonnet-4-6'
export const MODEL_CRITIC = 'claude-opus-4-7'

export const WEB_SEARCH_TOOL: WebSearchTool20260209 = {
  type: 'web_search_20260209',
  name: 'web_search',
  max_uses: 5,
}

let _client: Anthropic | null = null

export function getAnthropic(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')
    _client = new Anthropic({ apiKey })
  }
  return _client
}

export type Effort = 'low' | 'medium' | 'high' | 'max'

export interface CallAgentOptions {
  model?: string
  systemPrompt: string
  userContent: string
  maxTokens?: number
  tools?: ToolUnion[]
  effort?: Effort
}

export async function callAgentJSON<T>(opts: CallAgentOptions): Promise<T> {
  const client = getAnthropic()
  const model = opts.model ?? MODEL_DEFAULT

  const stream = client.messages.stream({
    model,
    max_tokens: opts.maxTokens ?? 4096,
    system: opts.systemPrompt,
    messages: [{ role: 'user', content: opts.userContent }],
    thinking: { type: 'adaptive' },
    ...(opts.effort ? { output_config: { effort: opts.effort } } : {}),
    ...(opts.tools && opts.tools.length > 0 ? { tools: opts.tools } : {}),
  })

  const final = await stream.finalMessage()
  const textBlocks = final.content.flatMap((b) =>
    b.type === 'text' ? [b.text] : []
  )
  const text = textBlocks.length > 0 ? textBlocks[textBlocks.length - 1] : ''

  if (!text) {
    const types = final.content.map((b) => b.type).join(',')
    throw new Error(
      `callAgentJSON: no text block returned. stop_reason=${final.stop_reason} block_types=[${types}] usage=${JSON.stringify(final.usage)}`
    )
  }

  return parseJSONBlock<T>(text)
}

function parseJSONBlock<T>(raw: string): T {
  let s = raw.trim()
  const fence = s.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/)
  if (fence) s = fence[1].trim()

  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(
      `callAgentJSON: no JSON object found in model response. First 300 chars: ${raw.slice(0, 300)}`
    )
  }
  const json = s.slice(start, end + 1)

  try {
    return JSON.parse(json) as T
  } catch (e) {
    const msg = (e as Error).message
    const posMatch = msg.match(/position (\d+)/)
    const pos = posMatch ? parseInt(posMatch[1], 10) : 0
    const window = json.slice(Math.max(0, pos - 200), Math.min(json.length, pos + 200))
    throw new Error(
      `callAgentJSON: JSON.parse failed (${msg}). Window around pos ${pos}:\n---\n${window}\n---`
    )
  }
}
