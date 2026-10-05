// Thin Buffer GraphQL calls for server-side jobs (the feeder). Shapes checked
// live 2026-10-05 against the HireDrop account:
// - posts(input: { organizationId, filter: { channelIds, status } }) lists a channel's queue;
// - createPost with mode customScheduled + dueAt schedules; assets = { image: { url } };
// - Instagram carousel = type 'post' with several images ('carousel' is rejected);
// - LimitReachedError = the channel's scheduled-posts cap (10 on the free plan) is full.

const BUFFER_API = 'https://api.buffer.com/graphql'

export class BufferLimitReached extends Error {}

async function gql<T>(token: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(BUFFER_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  })
  const json = (await res.json().catch(() => null)) as { data?: T; errors?: Array<{ message: string }> } | null
  if (!res.ok || !json?.data || json.errors?.length) {
    throw new Error(`Buffer ${res.status}: ${json?.errors?.map((e) => e.message).join('; ') ?? 'no data'}`)
  }
  return json.data
}

export async function bufferOrganizations(token: string): Promise<Array<{ id: string; scheduledLimit: number | null }>> {
  const d = await gql<{ account: { organizations: Array<{ id: string; limits?: { scheduledPosts?: number } }> } }>(
    token,
    '{ account { organizations { id limits { scheduledPosts } } } }',
  )
  return d.account.organizations.map((o) => ({ id: o.id, scheduledLimit: o.limits?.scheduledPosts ?? null }))
}

/** Scheduled posts on one channel, latest dueAt included. Pages through the whole queue. */
export async function bufferScheduled(
  token: string,
  organizationId: string,
  channelId: string,
): Promise<{ count: number; lastDueAt: string | null }> {
  let after: string | null = null
  let count = 0
  let lastDueAt: string | null = null
  for (let page = 0; page < 10; page++) {
    const d: {
      posts: {
        edges: Array<{ node: { dueAt: string | null } }>
        pageInfo: { hasNextPage: boolean; endCursor: string | null }
      }
    } = await gql(
      token,
      `query($org: OrganizationId!, $ch: [ChannelId!], $after: String) {
        posts(first: 50, after: $after, input: { organizationId: $org, filter: { channelIds: $ch, status: [scheduled] } }) {
          edges { node { dueAt } } pageInfo { hasNextPage endCursor }
        }
      }`,
      { org: organizationId, ch: [channelId], after },
    )
    for (const e of d.posts.edges) {
      count++
      if (e.node.dueAt && (!lastDueAt || e.node.dueAt > lastDueAt)) lastDueAt = e.node.dueAt
    }
    if (!d.posts.pageInfo.hasNextPage) break
    after = d.posts.pageInfo.endCursor
  }
  return { count, lastDueAt }
}

export async function bufferSchedulePost(
  token: string,
  input: {
    channelId: string
    service: 'instagram' | 'threads'
    text: string
    imageUrls: string[]
    dueAt: string
    threadsTopic?: string | null
  },
): Promise<string> {
  const metadata =
    input.service === 'instagram'
      ? { instagram: { type: 'post', shouldShareToFeed: true } }
      : { threads: { type: 'post', ...(input.threadsTopic ? { topic: input.threadsTopic } : {}) } }
  const d = await gql<{
    createPost: { __typename: string; message?: string; post?: { id: string } }
  }>(
    token,
    `mutation C($input: CreatePostInput!) { createPost(input: $input) { __typename
      ... on PostActionSuccess { post { id } } ... on InvalidInputError { message }
      ... on UnexpectedError { message } ... on LimitReachedError { message } ... on RestProxyError { message } } }`,
    {
      input: {
        channelId: input.channelId,
        text: input.text,
        schedulingType: 'automatic',
        mode: 'customScheduled',
        dueAt: input.dueAt,
        assets: input.imageUrls.map((url) => ({ image: { url } })),
        metadata,
      },
    },
  )
  const r = d.createPost
  if (r.__typename === 'LimitReachedError') throw new BufferLimitReached(r.message ?? 'limit reached')
  if (r.__typename !== 'PostActionSuccess' || !r.post) throw new Error(`${r.__typename}: ${r.message ?? ''}`)
  return r.post.id
}
