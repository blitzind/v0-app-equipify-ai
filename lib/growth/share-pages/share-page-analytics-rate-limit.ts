/** In-memory rate limiter for public share page analytics ingestion. */

const WINDOW_MS = 60_000
const MAX_REQUESTS_PER_WINDOW = 120

type RateLimitBucket = {
  count: number
  windowStart: number
}

const buckets = new Map<string, RateLimitBucket>()

export function checkSharePageAnalyticsRateLimit(key: string, now = Date.now()): { allowed: boolean; retryAfterMs?: number } {
  const bucket = buckets.get(key)
  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now })
    return { allowed: true }
  }

  if (bucket.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, retryAfterMs: WINDOW_MS - (now - bucket.windowStart) }
  }

  bucket.count += 1
  return { allowed: true }
}

export function resetSharePageAnalyticsRateLimitForTests(): void {
  buckets.clear()
}
