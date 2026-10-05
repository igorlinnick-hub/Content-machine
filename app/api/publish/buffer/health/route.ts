import { NextRequest, NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import {
  bufferAccountForClinic,
  bufferToken,
  type BufferService,
} from '@/lib/publish/buffer-accounts'

export const dynamic = 'force-dynamic'

const BUFFER_API = 'https://api.buffer.com/graphql'

export type ChannelHealthStatus =
  | 'connected'      // channel id verified against the live Buffer account
  | 'not_found'      // channel id configured but absent from the Buffer account
  | 'unverified'     // token works but the channel list could not be fetched
  | 'not_configured' // no channel id for this brand
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
  /** Brand has no Buffer account at all — publishing is switched off. */
  switchedOff?: boolean
  error?: string
}

interface LiveChannel {
  id: string
  name?: string
  displayName?: string
  service?: string
  avatar?: string
}

// Schema as of 2026-09-28: `channels` requires an organizationId, so the list
// is read per organization of the token's account.
const ORGS_QUERY = '{ account { organizations { id } } }'
const CHANNELS_QUERY = `query($org: OrganizationId!) {
  channels(input: { organizationId: $org }) { id name displayName service avatar }
}`

const AUTH_ERROR_RE = /unauthenticated|unauthorized|invalid.*token|token.*invalid|not.*authorized|access denied/i

async function gql(token: string, query: string, variables?: Record<string, unknown>): Promise<{
  http: number
  data: Record<string, unknown> | null
  errors: Array<{ message: string }> | null
}> {
  const res = await fetch(BUFFER_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  })
  const json = (await res.json().catch(() => null)) as {
    data?: Record<string, unknown>
    errors?: Array<{ message: string }>
  } | null
  return { http: res.status, data: json?.data ?? null, errors: json?.errors ?? null }
}

// GET /api/publish/buffer/health?clinicId=… — the connector state of ONE brand.
export async function GET(req: NextRequest) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const health: BufferHealth = { token: 'ok', verification: 'none', channels: {} }
  const finish = () => NextResponse.json(health, { headers: { 'Cache-Control': 'no-store' } })

  const clinicId = req.nextUrl.searchParams.get('clinicId') ?? ''
  if (!clinicId) {
    health.token = 'missing'
    health.error = 'clinicId required'
    return finish()
  }

  const { niche, account } = await bufferAccountForClinic(clinicId)
  if (!account) {
    health.token = 'missing'
    health.switchedOff = true
    health.error = `Publishing is switched off for this brand (niche: ${niche ?? 'none'})`
    return finish()
  }

  const configured = Object.entries(account.channels) as Array<[BufferService, string]>
  const token = bufferToken(account)
  if (!token) {
    health.token = 'missing'
    health.error = `${account.tokenEnv} is not set`
    for (const [ch] of configured) {
      health.channels[ch] = { status: 'disconnected', error: health.error }
    }
    return finish()
  }

  let live: LiveChannel[] | null = null
  try {
    const orgs = await gql(token, ORGS_QUERY)
    const orgErr = orgs.errors?.map((e) => e.message).join('; ') ?? ''
    if (orgs.http === 401 || orgs.http === 403 || AUTH_ERROR_RE.test(orgErr)) {
      health.token = 'invalid'
      health.error = `Buffer rejected the token — reconnect Buffer and update ${account.tokenEnv}`
      for (const [ch] of configured) {
        health.channels[ch] = { status: 'disconnected', error: 'Buffer token invalid' }
      }
      return finish()
    }
    const orgIds = (
      (orgs.data?.account as { organizations?: Array<{ id: string }> } | undefined)
        ?.organizations ?? []
    ).map((o) => o.id)
    const collected: LiveChannel[] = []
    for (const org of orgIds) {
      const r = await gql(token, CHANNELS_QUERY, { org })
      if (r.errors?.length) throw new Error(r.errors.map((e) => e.message).join('; '))
      collected.push(...((r.data?.channels as LiveChannel[] | undefined) ?? []))
    }
    live = collected
  } catch (e) {
    health.error = `Channel list unavailable: ${e instanceof Error ? e.message : String(e)}`
  }

  health.verification = live ? 'full' : 'token_only'

  if (configured.length === 0) {
    health.error = health.error ?? 'Token works, but no channel ids are set for this brand yet'
  }

  for (const [ch, id] of configured) {
    if (!live) {
      health.channels[ch] = { status: 'unverified', error: 'Token accepted but channel list could not be verified' }
      continue
    }
    const match = live.find((c) => c.id === id)
    health.channels[ch] = match
      ? { status: 'connected', name: match.displayName ?? match.name, username: match.name, avatar: match.avatar }
      : { status: 'not_found', error: `Channel ${id} is not in this Buffer account` }
  }

  return finish()
}
