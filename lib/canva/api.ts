import { CANVA_API, clearCanvaCache, getCanvaAccessToken } from './oauth'

// Canva Connect API surface used by the compose orchestrator:
//   • uploadAssetFromUrl  — Flux returns a URL; we stream bytes to Canva
//                           and get back an asset.id.
//   • createAutofillJob   — kicks off the brand-template fill with our
//                           field map. Async — returns job_id.
//   • pollAutofillJob     — polls until success/failed, returns the
//                           design URL.
//
// All calls retry once on 401 (token went stale mid-flight) by
// clearing the OAuth cache and trying again with a fresh token.

export class CanvaApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = 'CanvaApiError'
  }
}

async function authedFetch(
  path: string,
  init: RequestInit & { rawBody?: BodyInit; extraHeaders?: Record<string, string> } = {}
): Promise<Response> {
  const doFetch = async () => {
    const token = await getCanvaAccessToken()
    const headers: Record<string, string> = {
      authorization: `Bearer ${token}`,
      ...(init.headers as Record<string, string> | undefined),
      ...(init.extraHeaders ?? {}),
    }
    if (init.rawBody === undefined && init.body && !headers['content-type']) {
      headers['content-type'] = 'application/json'
    }
    return fetch(`${CANVA_API}${path}`, {
      ...init,
      headers,
      body: init.rawBody ?? init.body,
    })
  }

  let res = await doFetch()
  if (res.status === 401) {
    clearCanvaCache()
    res = await doFetch()
  }
  return res
}

// ─── Asset upload ─────────────────────────────────────────────────
// Canva's modern upload endpoint takes the binary in the request body
// with a base64-encoded JSON name in the Asset-Upload-Metadata header.
// Response is a job — poll /asset-uploads/{job_id}.

interface AssetUploadJobResponse {
  job: {
    id: string
    status: 'in_progress' | 'success' | 'failed'
    asset?: { id: string; name?: string }
    error?: { code?: string; message?: string }
  }
}

export async function uploadAssetFromUrl(
  imageUrl: string,
  name: string
): Promise<string> {
  // 1. Pull bytes from the source URL (Flux / Drive / stock).
  const src = await fetch(imageUrl)
  if (!src.ok) {
    throw new CanvaApiError(
      `failed to download source image: ${src.status}`,
      src.status
    )
  }
  const bytes = await src.arrayBuffer()

  // 2. Canva requires the asset name as base64 in the metadata header.
  const safeName = name.slice(0, 60).replace(/[^a-zA-Z0-9 _-]/g, '_')
  const metadata = Buffer.from(
    JSON.stringify({ name_base64: Buffer.from(safeName, 'utf8').toString('base64') })
  ).toString('base64')

  const start = await authedFetch('/asset-uploads', {
    method: 'POST',
    rawBody: bytes,
    extraHeaders: {
      'asset-upload-metadata': metadata,
      'content-type': 'application/octet-stream',
    },
  })
  if (!start.ok) {
    const text = await start.text().catch(() => '')
    throw new CanvaApiError(
      `asset-uploads ${start.status}: ${text.slice(0, 400)}`,
      start.status
    )
  }
  const startBody = (await start.json()) as AssetUploadJobResponse
  let job = startBody.job

  // 3. Poll the job. Upload jobs usually finish in <5s.
  const deadline = Date.now() + 60_000
  while (job.status === 'in_progress' && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500))
    const poll = await authedFetch(`/asset-uploads/${job.id}`, { method: 'GET' })
    if (!poll.ok) {
      const text = await poll.text().catch(() => '')
      throw new CanvaApiError(
        `asset-uploads poll ${poll.status}: ${text.slice(0, 400)}`,
        poll.status
      )
    }
    job = ((await poll.json()) as AssetUploadJobResponse).job
  }

  if (job.status !== 'success' || !job.asset?.id) {
    throw new CanvaApiError(
      `asset upload failed: ${job.error?.message ?? job.status}`,
      500
    )
  }
  return job.asset.id
}

// ─── Autofill (brand template fill) ───────────────────────────────
// POST /autofills creates a design from a brand template by replacing
// named placeholders. The `data` field maps placeholder names →
// typed values:
//   { "cover_title":   { type: "text",  text: "..." } }
//   { "cover_photo":   { type: "image", asset_id: "..." } }
// Returns a job — poll /autofills/{job_id} until success.

export type AutofillTextValue = { type: 'text'; text: string }
export type AutofillImageValue = { type: 'image'; asset_id: string }
export type AutofillValue = AutofillTextValue | AutofillImageValue

export interface AutofillRequest {
  brand_template_id: string
  title?: string
  data: Record<string, AutofillValue>
}

interface AutofillJobResponse {
  job: {
    id: string
    status: 'in_progress' | 'success' | 'failed'
    result?: {
      design?: {
        id: string
        urls?: { edit_url?: string; view_url?: string }
        // Some Canva responses expose thumbnail.url
        thumbnail?: { url?: string }
      }
    }
    error?: { code?: string; message?: string }
  }
}

export interface AutofillResult {
  designId: string
  editUrl: string
  thumbnailUrl: string | null
}

export async function createAutofillDesign(
  req: AutofillRequest,
  maxWaitMs = 180_000
): Promise<AutofillResult> {
  const start = await authedFetch('/autofills', {
    method: 'POST',
    body: JSON.stringify(req),
  })
  if (!start.ok) {
    const text = await start.text().catch(() => '')
    throw new CanvaApiError(
      `autofills ${start.status}: ${text.slice(0, 400)}`,
      start.status
    )
  }

  let job = ((await start.json()) as AutofillJobResponse).job
  const deadline = Date.now() + maxWaitMs

  while (job.status === 'in_progress' && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000))
    const poll = await authedFetch(`/autofills/${job.id}`, { method: 'GET' })
    if (!poll.ok) {
      const text = await poll.text().catch(() => '')
      throw new CanvaApiError(
        `autofills poll ${poll.status}: ${text.slice(0, 400)}`,
        poll.status
      )
    }
    job = ((await poll.json()) as AutofillJobResponse).job
  }

  if (job.status !== 'success' || !job.result?.design) {
    throw new CanvaApiError(
      `autofill failed: ${job.error?.message ?? job.status}`,
      500
    )
  }
  const design = job.result.design
  const editUrl =
    design.urls?.edit_url ??
    `https://www.canva.com/design/${design.id}/edit`
  return {
    designId: design.id,
    editUrl,
    thumbnailUrl: design.thumbnail?.url ?? null,
  }
}
