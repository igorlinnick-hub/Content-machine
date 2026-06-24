import { NextRequest, NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'

const BUFFER_API = 'https://api.buffer.com/graphql'

const CHANNEL_MAP: Record<string, string> = {
  instagram: process.env.BUFFER_CHANNEL_INSTAGRAM ?? '',
  facebook: process.env.BUFFER_CHANNEL_FACEBOOK ?? '',
  tiktok: process.env.BUFFER_CHANNEL_TIKTOK ?? '',
}

// Instagram always needs at least one asset; Facebook/TikTok support text-only
const REQUIRES_MEDIA = new Set(['instagram', 'tiktok'])

interface PublishBody {
  channels: Array<'instagram' | 'facebook' | 'tiktok'>
  text: string
  mediaUrls?: string[]
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

function buildMetadata(channel: string) {
  if (channel === 'instagram') return { instagram: { type: 'post', shouldShareToFeed: true } }
  if (channel === 'facebook') return { facebook: { type: 'post' } }
  return {}
}

async function bufferPost(
  channel: string,
  channelId: string,
  text: string,
  assets: Array<{ url: string }>,
  scheduledAt?: string,
) {
  const token = process.env.BUFFER_TOKEN
  if (!token) throw new Error('BUFFER_TOKEN not set')

  const mode = scheduledAt ? 'customScheduled' : 'addToQueue'

  const variables = {
    input: {
      channelId,
      text,
      schedulingType: 'automatic',
      mode,
      assets,
      metadata: buildMetadata(channel),
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

  const { channels, text, mediaUrls, scheduledAt } = body

  if (!channels?.length) return NextResponse.json({ error: 'channels required' }, { status: 400 })
  if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 })

  const assets = (mediaUrls ?? []).map((url) => ({ url }))
  const results: Array<{ channel: string; postId?: string; status?: string; error?: string }> = []

  for (const ch of channels) {
    const channelId = CHANNEL_MAP[ch]
    if (!channelId) {
      results.push({ channel: ch, error: 'Channel ID not configured' })
      continue
    }

    if (REQUIRES_MEDIA.has(ch) && assets.length === 0) {
      results.push({ channel: ch, error: `${ch} requires at least one image or video` })
      continue
    }

    try {
      const r = await bufferPost(ch, channelId, text, assets, scheduledAt)
      results.push(r)
    } catch (err) {
      results.push({ channel: ch, error: err instanceof Error ? err.message : String(err) })
    }
  }

  const allFailed = results.every((r) => r.error)
  return NextResponse.json({ results }, { status: allFailed ? 502 : 200 })
}
