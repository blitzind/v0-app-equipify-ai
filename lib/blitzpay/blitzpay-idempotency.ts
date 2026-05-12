import "server-only"

export const BLITZPAY_IDEMPOTENCY_KEY_MIN = 8
export const BLITZPAY_IDEMPOTENCY_KEY_MAX = 512

export function normalizeBlitzpayObservabilityIdempotencyKey(raw: string): string {
  return raw.normalize("NFKC").trim().slice(0, BLITZPAY_IDEMPOTENCY_KEY_MAX)
}

export function validateBlitzpayObservabilityIdempotencyKey(raw: string | null | undefined): { ok: true; key: string } | { ok: false; code: string } {
  if (raw == null || typeof raw !== "string") return { ok: false, code: "missing" }
  const key = normalizeBlitzpayObservabilityIdempotencyKey(raw)
  if (key.length < BLITZPAY_IDEMPOTENCY_KEY_MIN) return { ok: false, code: "too_short" }
  return { ok: true, key }
}

export type BlitzpayIdempotencyEvaluation = "open" | "replay_same" | "conflict"

/**
 * Duplicate keys with different request hashes are conflicts (bounded caller supplies rows).
 */
export function evaluateBlitzpayIdempotencyRecord(input: {
  existingRequestHash: string | null
  incomingRequestHash: string | null
}): BlitzpayIdempotencyEvaluation {
  const a = input.existingRequestHash
  const b = input.incomingRequestHash
  if (a && b && a !== b) return "conflict"
  if (a && b && a === b) return "replay_same"
  return "open"
}
