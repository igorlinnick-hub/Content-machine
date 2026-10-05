// Direct publishing to Instagram and Threads through Meta's Graph APIs —
// no Buffer in between, so no 10-posts-per-channel queue limit.
//
// Both APIs work the same way: create a container per image, then a
// CAROUSEL container holding them, wait until Meta has fetched the images,
// then publish the container. A published container reports status
// PUBLISHED, which is how a retry tells "already went out" from "never
// went out" without posting twice.
//
// Images must be public URLs. Instagram takes JPEG only (PNG is rejected);
// Threads takes JPEG and PNG. Instagram carousels: 2–10 items; Threads: 2–20.

export type MetaNetwork = 'instagram' | 'threads'

export interface InstagramCreds {
  igUserId: string
  accessToken: string
  /** graph.facebook.com (Facebook Login) or graph.instagram.com (Instagram Login). */
  graphHost?: string
}

export interface ThreadsCreds {
  userId: string
  accessToken: string
}

export interface PublishResult {
  mediaId: string | null
  permalink: string | null
}

const IG_VERSION = 'v21.0'
const THREADS_BASE = 'https://graph.threads.net/v1.0'

export class MetaApiError extends Error {
  constructor(
    message: string,
    /** false = retrying cannot help (bad image, policy, revoked token). */
    readonly retryable: boolean,
  ) {
    super(message)
  }
}

async function call(
  method: 'GET' | 'POST',
  url: string,
  params: Record<string, string>,
): Promise<Record<string, unknown>> {
  const body = new URLSearchParams(params)
  const res = await fetch(method === 'GET' ? `${url}?${body}` : url, {
    method,
    ...(method === 'POST' ? { body } : {}),
    cache: 'no-store',
  })
  const json = (await res.json().catch(() => ({}))) as {
    error?: { message?: string; code?: number; is_transient?: boolean }
  } & Record<string, unknown>
  if (!res.ok || json.error) {
    const e = json.error ?? {}
    // Worth retrying: Meta-side hiccups and rate limits (4/17/32/613). Not
    // worth it: 190 token invalid, 10/200 permission missing, 100 bad
    // parameter (often an image Meta could not fetch or read).
    const retryable =
      Boolean(e.is_transient) ||
      [4, 17, 32, 613].includes(e.code ?? -1) ||
      res.status >= 500 ||
      res.status === 429
    throw new MetaApiError(
      `${res.status} ${e.message ?? 'Meta API error'}${e.code ? ` (code ${e.code})` : ''}`,
      retryable,
    )
  }
  return json
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Polls a container until Meta has processed it. */
async function waitReady(
  check: () => Promise<string>,
  { tries = 12, everyMs = 5000 } = {},
): Promise<void> {
  for (let i = 0; i < tries; i++) {
    const status = await check()
    if (status === 'FINISHED' || status === 'PUBLISHED') return
    if (status === 'ERROR' || status === 'EXPIRED') {
      throw new MetaApiError(`container ${status}`, status === 'EXPIRED')
    }
    await sleep(everyMs)
  }
  throw new MetaApiError('container still processing after 60s', true)
}

// ── Instagram ────────────────────────────────────────────────────────────────

function igBase(c: InstagramCreds) {
  return `https://${c.graphHost ?? 'graph.facebook.com'}/${IG_VERSION}`
}

async function igStatus(c: InstagramCreds, containerId: string): Promise<string> {
  const r = await call('GET', `${igBase(c)}/${containerId}`, {
    fields: 'status_code',
    access_token: c.accessToken,
  })
  return String(r.status_code ?? '')
}

/** Creates the container(s) and returns the id to publish. */
export async function createInstagramContainer(
  c: InstagramCreds,
  imageUrls: string[],
  caption: string,
): Promise<string> {
  const base = `${igBase(c)}/${c.igUserId}/media`
  const token = c.accessToken
  if (imageUrls.length === 1) {
    const r = await call('POST', base, { image_url: imageUrls[0], caption, access_token: token })
    return String(r.id)
  }
  if (imageUrls.length > 10) throw new MetaApiError('Instagram carousel takes at most 10 images', false)
  const children: string[] = []
  for (const url of imageUrls) {
    const r = await call('POST', base, { image_url: url, is_carousel_item: 'true', access_token: token })
    children.push(String(r.id))
  }
  const r = await call('POST', base, {
    media_type: 'CAROUSEL',
    children: children.join(','),
    caption,
    access_token: token,
  })
  return String(r.id)
}

export async function publishInstagramContainer(
  c: InstagramCreds,
  containerId: string,
): Promise<PublishResult> {
  if ((await igStatus(c, containerId)) === 'PUBLISHED') return { mediaId: null, permalink: null }
  await waitReady(() => igStatus(c, containerId))
  const r = await call('POST', `${igBase(c)}/${c.igUserId}/media_publish`, {
    creation_id: containerId,
    access_token: c.accessToken,
  })
  const mediaId = String(r.id)
  const p = await call('GET', `${igBase(c)}/${mediaId}`, {
    fields: 'permalink',
    access_token: c.accessToken,
  }).catch(() => ({}) as Record<string, unknown>)
  return { mediaId, permalink: (p.permalink as string) ?? null }
}

// ── Threads ──────────────────────────────────────────────────────────────────

async function threadsStatus(c: ThreadsCreds, containerId: string): Promise<string> {
  const r = await call('GET', `${THREADS_BASE}/${containerId}`, {
    fields: 'status',
    access_token: c.accessToken,
  })
  return String(r.status ?? '')
}

export async function createThreadsContainer(
  c: ThreadsCreds,
  imageUrls: string[],
  text: string,
): Promise<string> {
  const base = `${THREADS_BASE}/${c.userId}/threads`
  const token = c.accessToken
  if (text.length > 500) throw new MetaApiError(`Threads text is ${text.length} chars, limit 500`, false)
  if (imageUrls.length === 0) {
    const r = await call('POST', base, { media_type: 'TEXT', text, access_token: token })
    return String(r.id)
  }
  if (imageUrls.length === 1) {
    const r = await call('POST', base, { media_type: 'IMAGE', image_url: imageUrls[0], text, access_token: token })
    return String(r.id)
  }
  if (imageUrls.length > 20) throw new MetaApiError('Threads carousel takes at most 20 images', false)
  const children: string[] = []
  for (const url of imageUrls) {
    const r = await call('POST', base, {
      media_type: 'IMAGE',
      image_url: url,
      is_carousel_item: 'true',
      access_token: token,
    })
    children.push(String(r.id))
  }
  const r = await call('POST', base, {
    media_type: 'CAROUSEL',
    children: children.join(','),
    text,
    access_token: token,
  })
  return String(r.id)
}

export async function publishThreadsContainer(
  c: ThreadsCreds,
  containerId: string,
): Promise<PublishResult> {
  if ((await threadsStatus(c, containerId)) === 'PUBLISHED') return { mediaId: null, permalink: null }
  await waitReady(() => threadsStatus(c, containerId))
  const r = await call('POST', `${THREADS_BASE}/${c.userId}/threads_publish`, {
    creation_id: containerId,
    access_token: c.accessToken,
  })
  const mediaId = String(r.id)
  const p = await call('GET', `${THREADS_BASE}/${mediaId}`, {
    fields: 'permalink',
    access_token: c.accessToken,
  }).catch(() => ({}) as Record<string, unknown>)
  return { mediaId, permalink: (p.permalink as string) ?? null }
}
