// In-memory per-IP throttle for the login endpoint. Vercel cold-starts
// reset state — that's acceptable here because (a) the token alphabet
// is large enough that sustained brute-force takes years, (b) admin
// codes are admin-set (min 3 chars) and the admin is told to use
// longer ones, (c) the real long-term defence is the unique-index
// + rotation, not perfect throttling.
//
// If we ever want durable rate limiting, swap this for a Supabase
// table with a TTL cleanup job.

interface Bucket {
  count: number
  firstAttempt: number
}

const WINDOW_MS = 15 * 60 * 1000      // 15 minutes
const MAX_ATTEMPTS = 5                  // per IP per window

const buckets = new Map<string, Bucket>()

export interface RateLimitDecision {
  allowed: boolean
  retryAfterSeconds: number
  remaining: number
}

export function recordAttempt(key: string): RateLimitDecision {
  const now = Date.now()
  const existing = buckets.get(key)
  if (!existing || now - existing.firstAttempt > WINDOW_MS) {
    buckets.set(key, { count: 1, firstAttempt: now })
    return { allowed: true, retryAfterSeconds: 0, remaining: MAX_ATTEMPTS - 1 }
  }
  if (existing.count >= MAX_ATTEMPTS) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((WINDOW_MS - (now - existing.firstAttempt)) / 1000)
    )
    return { allowed: false, retryAfterSeconds, remaining: 0 }
  }
  existing.count += 1
  return {
    allowed: true,
    retryAfterSeconds: 0,
    remaining: MAX_ATTEMPTS - existing.count,
  }
}

export function clearAttempts(key: string): void {
  buckets.delete(key)
}

export function ipFromRequest(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}
