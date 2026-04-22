import Anthropic from '@anthropic-ai/sdk'

export const MODEL_DEFAULT = 'claude-sonnet-4-6'
export const MODEL_CRITIC = 'claude-opus-4-7'

let _client: Anthropic | null = null

export function getAnthropic(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')
    _client = new Anthropic({ apiKey })
  }
  return _client
}

export interface CallAgentOptions {
  model?: string
  systemPrompt: string
  userContent: string
  maxTokens?: number
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
  })

  const final = await stream.finalMessage()
  const text = final.content
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('')

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
    throw new Error(
      `callAgentJSON: JSON.parse failed (${(e as Error).message}). First 300 chars: ${json.slice(0, 300)}`
    )
  }
}
