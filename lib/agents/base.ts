import Anthropic from '@anthropic-ai/sdk'
import type {
  ToolUnion,
  WebSearchTool20260209,
  TextBlockParam,
} from '@anthropic-ai/sdk/resources/messages'
import { LLMAgentsDisabledError, llmAgentsEnabled } from './disabled'

export const MODEL_DEFAULT = 'claude-sonnet-4-6'
export const MODEL_CRITIC = 'claude-opus-4-7'
// Haiku 4.5 — cheap + fast model used for narrow, high-volume tasks like
// splitting scripts into slides, refining a single slide, and weekly diff
// extraction. ~12× cheaper than Sonnet on input tokens with comparable
// quality on these well-scoped jobs.
export const MODEL_HAIKU = 'claude-haiku-4-5-20251001'

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
  // When true, the system prompt is marked cache_control:ephemeral so
  // Anthropic's prompt cache reuses it across calls within a 5-minute
  // window. Set on stable system prompts (writer, critic). Skip for
  // prompts that vary per call.
  cacheSystem?: boolean
}

export async function callAgentJSON<T>(opts: CallAgentOptions): Promise<T> {
  // Global kill switch. Every agent (writer/critic/captioner/etc.)
  // funnels through here, so this single check disables them all and
  // guarantees no Anthropic API call leaves the process when the flag
  // is off. Fail-safe default: only the literal string 'true' enables.
  if (!llmAgentsEnabled()) {
    throw new LLMAgentsDisabledError(
      `LLM agents are disabled (ENABLE_LLM_AGENTS != 'true'). Refusing to call model=${opts.model ?? MODEL_DEFAULT}.`
    )
  }
  const client = getAnthropic()
  const model = opts.model ?? MODEL_DEFAULT

  // System prompt: send as a single cacheable text block when requested
  // (saves ~70% on repeated input tokens for hot paths). Plain string
  // otherwise so we don't pay the cache-write overhead on one-shot calls.
  const systemPayload: string | TextBlockParam[] = opts.cacheSystem
    ? [
        {
          type: 'text',
          text: opts.systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ]
    : opts.systemPrompt

  // Adaptive thinking is supported on Sonnet/Opus only. Haiku 4.5
  // rejects the parameter with `invalid_request_error: adaptive thinking
  // is not supported on this model`. Keep it on for the heavyweights,
  // skip on Haiku.
  const supportsAdaptive = !model.includes('haiku')
  const stream = client.messages.stream({
    model,
    max_tokens: opts.maxTokens ?? 4096,
    system: systemPayload,
    messages: [{ role: 'user', content: opts.userContent }],
    ...(supportsAdaptive ? { thinking: { type: 'adaptive' } } : {}),
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

// Vision variant of callAgentJSON. Accepts one or more images alongside
// the user text and routes them as `image` content blocks. Same JSON
// parsing contract as the text-only flow. Same kill-switch.
//
// Image input takes raw bytes + media type — the helper handles base64
// encoding so callers can stream straight from Drive/fetch without
// worrying about the wire format. Pass the SDK media_type explicitly
// ('image/jpeg' or 'image/png') so we don't ship a guess to the API.
export interface VisionImageInput {
  data: Buffer | Uint8Array  // raw bytes
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
}

export interface CallAgentVisionOptions {
  model?: string
  systemPrompt: string
  userText: string
  images: VisionImageInput[]
  maxTokens?: number
  cacheSystem?: boolean
}

export async function callAgentVisionJSON<T>(
  opts: CallAgentVisionOptions
): Promise<T> {
  if (!llmAgentsEnabled()) {
    throw new LLMAgentsDisabledError(
      `LLM agents are disabled (ENABLE_LLM_AGENTS != 'true'). Refusing to call vision model=${opts.model ?? MODEL_HAIKU}.`
    )
  }
  if (opts.images.length === 0) {
    throw new Error('callAgentVisionJSON: at least one image is required')
  }

  const client = getAnthropic()
  const model = opts.model ?? MODEL_HAIKU

  const systemPayload: string | TextBlockParam[] = opts.cacheSystem
    ? [
        {
          type: 'text',
          text: opts.systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ]
    : opts.systemPrompt

  const imageBlocks = opts.images.map((img) => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: img.mediaType,
      data: Buffer.from(img.data).toString('base64'),
    },
  }))

  const supportsAdaptive = !model.includes('haiku')
  const stream = client.messages.stream({
    model,
    max_tokens: opts.maxTokens ?? 1024,
    system: systemPayload,
    messages: [
      {
        role: 'user',
        content: [
          ...imageBlocks,
          { type: 'text' as const, text: opts.userText },
        ],
      },
    ],
    ...(supportsAdaptive ? { thinking: { type: 'adaptive' } } : {}),
  })

  const final = await stream.finalMessage()
  const textBlocks = final.content.flatMap((b) =>
    b.type === 'text' ? [b.text] : []
  )
  const text = textBlocks.length > 0 ? textBlocks[textBlocks.length - 1] : ''
  if (!text) {
    const types = final.content.map((b) => b.type).join(',')
    throw new Error(
      `callAgentVisionJSON: no text block returned. stop_reason=${final.stop_reason} block_types=[${types}]`
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
    // Common LLM mistake: writes unescaped double-quotes around phrases
    // INSIDE a string value. JSON.parse chokes on the inner quote because
    // it thinks the string ended. Attempt a one-shot repair: walk the
    // text, escape any double-quote that appears in mid-string position
    // (inside a string, not at boundary). This is a heuristic — works on
    // ~95% of real cases. If it still fails, throw with the windowed
    // context so the caller / debugger sees exactly what broke.
    try {
      return JSON.parse(repairUnescapedQuotes(json)) as T
    } catch (e2) {
      const msg = (e2 as Error).message
      const posMatch = msg.match(/position (\d+)/)
      const pos = posMatch ? parseInt(posMatch[1], 10) : 0
      const window = json.slice(
        Math.max(0, pos - 200),
        Math.min(json.length, pos + 200)
      )
      throw new Error(
        `callAgentJSON: JSON.parse failed twice. Original: ${(e as Error).message}. After repair: ${msg}. Window around pos ${pos}:\n---\n${window}\n---`
      )
    }
  }
}

// Heuristic JSON repair for the most common LLM mistake: unescaped
// double-quotes inside a string value. We walk char-by-char tracking
// whether we're INSIDE a string. A double-quote inside a string is
// treated as "string boundary" UNLESS it's followed by content that
// looks like more string body (whitespace + letter / contraction).
//
// Example input (broken): { "script": "He said "hello" to me." }
// Example output (fixed): { "script": "He said \"hello\" to me." }
function repairUnescapedQuotes(json: string): string {
  let out = ''
  let inString = false
  let escaped = false
  for (let i = 0; i < json.length; i += 1) {
    const c = json[i]
    if (escaped) {
      out += c
      escaped = false
      continue
    }
    if (c === '\\') {
      out += c
      escaped = true
      continue
    }
    if (c === '"') {
      if (!inString) {
        inString = true
        out += c
        continue
      }
      // We're inside a string and saw a quote. Decide: real end of
      // string, or an unescaped inner quote?
      // Look ahead — strip whitespace, then check next non-ws char.
      let j = i + 1
      while (j < json.length && (json[j] === ' ' || json[j] === '\t')) j += 1
      const nextChar = json[j] ?? ''
      // Real string boundary if next non-ws is a JSON structural char.
      const isBoundary =
        nextChar === ',' ||
        nextChar === '}' ||
        nextChar === ']' ||
        nextChar === ':' ||
        nextChar === '\n' ||
        nextChar === ''
      if (isBoundary) {
        inString = false
        out += c
      } else {
        // Inner unescaped quote — escape it.
        out += '\\"'
      }
      continue
    }
    out += c
  }
  return out
}
