import { NextRequest, NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import {
  BUFFER_SERVICES,
  bufferAccountForClinic,
  bufferToken,
  type BufferService,
} from '@/lib/publish/buffer-accounts'

const BUFFER_API = 'https://api.buffer.com/graphql'

// Instagram always needs at least one asset; the rest support text-only
const REQUIRES_MEDIA = new Set<BufferService>(['instagram', 'tiktok'])

interface PublishBody {
  /** Brand to publish as — decides the Buffer account and channel ids. */
  clinicId: string
  channels: BufferService[]
  text: string
  mediaUrls?: string[]
  /**
   * Threads only: the parts of a multi-post thread, first part included.
   * One part (or none) = a single post built from `text`.
   */
  thread?: string[]
  scheduledAt?: string // ISO string; omit → add to queue as draft
}

const MUTATION = `
  mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
      __typename
      ... on PostActionSuccess { post { id status } }
      ... on InvalidInputError { message }
      ... on UnexpectedError   { message }
      ... on RestProxyError    { message }
      ... on LimitReachedError { message }
      ... on UnauthorizedError { message }
    }
  }
`

function buildMetadata(channel: BufferService, thread: string[]) {
  if (channel === 'instagram') return { instagram: { type: 'post', shouldShareToFeed: true } }
  if (channel === 'facebook') return { facebook: { type: 'post' } }
  if (channel === 'threads') {
    // ThreadsPostMetadataInput.thread = [ThreadedPostInput{text, assets}].
    // Schema read by introspection 2026-09-28; a live thread has not been sent yet.
    return thread.length > 1
      ? { threads: { type: 'thread', thread: thread.map((text) => ({ text, assets: [] })) } }
      : { threads: { type: 'post' } }
  }
  return {}
}

async function bufferPost(
  token: string,
  channel: BufferService,
  channelId: string,
  text: string,
  assets: Array<{ image: { url: string } }>,
  thread: string[],
  scheduledAt?: string,
) {
  const mode = scheduledAt ? 'customScheduled' : 'addToQueue'

  const variables = {
    input: {
      channelId,
      text,
      schedulingType: 'automatic',
      mode,
      assets,
      metadata: buildMetadata(channel, thread),
      ...(scheduledAt ? { dueAt: scheduledAt } : { saveToDraft: true }),
    },
  }

  const res = await fetch(BUFFER_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: MUTATION, variables }),
  })

  const json = (await res.json()) as {
    data?: { createPost: { __typename: string; post?: { id: string; status: string }; message?: string } }
    errors?: Array<{ message: string }>
  }

  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join('; '))

  const result = json.data?.createPost
  if (!result) throw new Error('Empty response from Buffer')

  if (result.__typename === 'PostActionSuccess') {
    return { channel, postId: result.post?.id, status: result.post?.status }
  }

  throw new Error(result.message ?? result.__typename)
}

export async function POST(req: NextRequest) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: PublishBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { clinicId, channels, mediaUrls, scheduledAt } = body
  const thread = (body.thread ?? []).map((t) => t.trim()).filter(Boolean)
  const text = thread[0] ?? body.text

  if (!clinicId) return NextResponse.json({ error: 'clinicId required' }, { status: 400 })
  if (!channels?.length) return NextResponse.json({ error: 'channels required' }, { status: 400 })
  if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 })

  const { niche, account } = await bufferAccountForClinic(clinicId)
  if (!account) {
    return NextResponse.json(
      { error: `Publishing is switched off for this brand (niche: ${niche ?? 'none'})` },
      { status: 403 },
    )
  }
  const token = bufferToken(account)
  if (!token) {
    return NextResponse.json({ error: `${account.tokenEnv} is not set` }, { status: 503 })
  }

  // AssetInput is a union-like object: { image | video | document }. A bare { url } is rejected.
  // Several images on Instagram = carousel; the post type stays 'post' (Buffer refuses 'carousel').
  const assets = (mediaUrls ?? []).map((url) => ({ image: { url } }))
  const results: Array<{ channel: string; postId?: string; status?: string; error?: string }> = []

  for (const ch of channels) {
    if (!BUFFER_SERVICES.includes(ch)) {
      results.push({ channel: ch, error: 'Unknown channel' })
      continue
    }
    const channelId = account.channels[ch]
    if (!channelId) {
      results.push({ channel: ch, error: `No ${ch} channel connected for this brand` })
      continue
    }

    if (REQUIRES_MEDIA.has(ch) && assets.length === 0) {
      results.push({ channel: ch, error: `${ch} requires at least one image or video` })
      continue
    }

    try {
      const r = await bufferPost(
        token,
        ch,
        channelId,
        text,
        assets,
        ch === 'threads' ? thread : [],
        scheduledAt,
      )
      results.push(r)
    } catch (err) {
      results.push({ channel: ch, error: err instanceof Error ? err.message : String(err) })
    }
  }

  const allFailed = results.every((r) => r.error)
  return NextResponse.json({ results }, { status: allFailed ? 502 : 200 })
}
