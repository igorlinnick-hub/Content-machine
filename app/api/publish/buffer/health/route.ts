import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

const BUFFER_API = 'https://api.buffer.com/graphql'

const ENV_CHANNELS: Record<string, string> = {
  instagram: process.env.BUFFER_CHANNEL_INSTAGRAM ?? '',
  facebook: process.env.BUFFER_CHANNEL_FACEBOOK ?? '',
  tiktok: process.env.BUFFER_CHANNEL_TIKTOK ?? '',
}

export type ChannelHealthStatus =
  | 'connected'      // env channel ID verified against the live Buffer account
  | 'not_found'      // env channel ID set but absent from the Buffer account
  | 'unverified'     // token works but the channel list could not be fetched
  | 'not_configured' // no env channel ID
  | 'disconnected'   // token missing or invalid

export interface ChannelHealth {
  status: ChannelHealthStatus
  name?: string
  username?: string
  avatar?: string
  error?: string
}

export interface BufferHealth {
  token: 'ok' | 'missing' | 'invalid'
  verification: 'full' | 'token_only' | 'none'
  channels: Record<string, ChannelHealth>
  error?: string
}

interface BufferChannel {
  id: string
  name?: string
  service?: string
  username?: string
  avatar?: string
}

// Buffer's GraphQL schema is not publicly documented; the channel list may
// live at different roots depending on API version, so we try each shape.
const CHANNEL_QUERIES = [
  '{ channels { id name service username avatar } }',
  '{ account { channels { id name service username avatar } } }',
]

const AUTH_ERROR_RE = /unauthenticated|unauthorized|invalid.*token|token.*invalid|not.*authorized|access denied/i

async function gql(token: string, query: string): Promise<{
  http: number
  data: Record<string, unknown> | null
  errors: Array<{ message: string }> | null
}> {
  const res = await fetch(BUFFER_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    cache: 'no-store',
  })
  const json = (await res.json().catch(() => null)) as {
    data?: Record<string, unknown>
    errors?: Array<{ message: string }>
  } | null
  return { http: res.status, data: json?.data ?? null, errors: json?.errors ?? null }
}

function extractChannels(data: Record<string, unknown> | null): BufferChannel[] | null {
  if (!data) return null
  const direct = data.channels
  if (Array.isArray(direct)) return direct as BufferChannel[]
  const account = data.account as { channels?: unknown } | undefined
  if (account && Array.isArray(account.channels)) return account.channels as BufferChannel[]
  return null
}

export async function GET() {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = process.env.BUFFER_TOKEN
  const health: BufferHealth = { token: 'ok', verification: 'none', channels: {} }

  const finish = () => NextResponse.json(health, { headers: { 'Cache-Control': 'no-store' } })

  if (!token) {
    health.token = 'missing'
    health.error = 'BUFFER_TOKEN is not set'
    for (const ch of Object.keys(ENV_CHANNELS)) {
      health.channels[ch] = { status: 'disconnected', error: 'BUFFER_TOKEN is not set' }
    }
    return finish()
  }

  let live: BufferChannel[] | null = null
  let tokenInvalid = false
  let lastError: string | null = null

  for (const query of CHANNEL_QUERIES) {
    try {
      const { http, data, errors } = await gql(token, query)
      if (http === 401 || http === 403) { tokenInvalid = true; break }
      if (errors?.length) {
        const msg = errors.map(e => e.message).join('; ')
        if (AUTH_ERROR_RE.test(msg)) { tokenInvalid = true; break }
        lastError = msg // most likely a schema mismatch — try the next shape
        continue
      }
      const channels = extractChannels(data)
      if (channels) { live = channels; break }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e)
    }
  }

  if (tokenInvalid) {
    health.token = 'invalid'
    health.error = 'Buffer rejected the token — reconnect Buffer and update BUFFER_TOKEN'
    for (const ch of Object.keys(ENV_CHANNELS)) {
      health.channels[ch] = { status: 'disconnected', error: 'Buffer token invalid' }
    }
    return finish()
  }

  health.verification = live ? 'full' : 'token_only'
  if (!live && lastError) health.error = `Channel list unavailable: ${lastError}`

  for (const [ch, envId] of Object.entries(ENV_CHANNELS)) {
    if (!envId) {
      health.channels[ch] = { status: 'not_configured', error: `BUFFER_CHANNEL_${ch.toUpperCase()} is not set` }
      continue
    }
    if (!live) {
      health.channels[ch] = { status: 'unverified', error: 'Token accepted but channel list could not be verified' }
      continue
    }
    const match = live.find(c => c.id === envId)
    health.channels[ch] = match
      ? { status: 'connected', name: match.name, username: match.username, avatar: match.avatar }
      : { status: 'not_found', error: `Channel ID ${envId} is not in the connected Buffer account` }
  }

  return finish()
}
