import "server-only"

import { sanitizeBlitzpayObservabilityJson } from "@/lib/blitzpay/blitzpay-observability"

/** Keys removed from nested observability JSON (defense in depth on top of key-based secret stripping). */
const NESTED_SENSITIVE_KEY_RE =
  /(event_hash|request_hash|signature_hash|payout_reference_hash|webhook_secret|client_secret|stripe_secret)/i

const STRIPE_LIKE_PREFIX =
  /^(cus_|pi_|ch_|pm_|seti_|card_|acct_|ba_|src_|tok_|re_|sub_|evt_|price_|prod_|in_|mandate_|cs_|sess_)/i

function redactStripeLikeString(value: string): string {
  if (!STRIPE_LIKE_PREFIX.test(value)) return value
  if (value.length <= 12) return `${value.slice(0, 6)}…`
  return `${value.slice(0, 10)}…`
}

function redactDigestLikeString(value: string): string {
  if (/^[0-9a-f]{64}$/i.test(value) || /^[0-9a-f]{40}$/i.test(value)) return "[redacted]"
  return value
}

function deepSanitizeObservabilityValue(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === "string") {
    return redactDigestLikeString(redactStripeLikeString(value))
  }
  if (typeof value !== "object") return value
  if (Array.isArray(value)) return value.map(deepSanitizeObservabilityValue)
  const obj = value as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const k of Object.keys(obj).sort()) {
    if (NESTED_SENSITIVE_KEY_RE.test(k)) continue
    out[k] = deepSanitizeObservabilityValue(obj[k])
  }
  return out
}

/**
 * Observability / audit JSON: strips secret-ish keys, then redacts Stripe-like ids and raw digests in leaf strings.
 */
export function sanitizeBlitzpayObservabilityJsonForApi(input: Record<string, unknown>): Record<string, unknown> {
  return deepSanitizeObservabilityValue(sanitizeBlitzpayObservabilityJson(input)) as Record<string, unknown>
}

export function truncateOpaqueKeyForList(value: unknown, maxLen: number): string | null {
  if (value == null) return null
  const s = String(value)
  if (!s) return null
  if (s.length <= maxLen) return s
  return `${s.slice(0, Math.max(1, maxLen - 1))}…`
}

/** Staff observability list: never ship full integrity hashes or raw provider references. */
export function shapeBlitzpayObservabilityFinancialEventListItem(row: Record<string, unknown>): Record<string, unknown> {
  const { event_hash: _eventHash, event_payload: ep, metadata: md, source_reference, idempotency_key, ...rest } = row
  return {
    ...rest,
    source_reference:
      source_reference == null || source_reference === "" ? source_reference : redactStripeLikeString(String(source_reference)),
    idempotency_key: truncateOpaqueKeyForList(idempotency_key, 48),
    event_payload: sanitizeBlitzpayObservabilityJsonForApi((ep as Record<string, unknown>) ?? {}),
    metadata: sanitizeBlitzpayObservabilityJsonForApi((md as Record<string, unknown>) ?? {}),
    integrity_recorded: Boolean(_eventHash),
  }
}

export function shapeBlitzpayIdempotencyRecordListItem(row: Record<string, unknown>): Record<string, unknown> {
  const {
    request_hash: _requestHash,
    idempotency_key: ik,
    metadata: md,
    response_reference: rr,
    ...rest
  } = row
  return {
    ...rest,
    idempotency_key: truncateOpaqueKeyForList(ik, 40),
    response_reference: rr == null || rr === "" ? rr : redactStripeLikeString(String(rr)),
    request_integrity_recorded: Boolean(_requestHash),
    metadata: sanitizeBlitzpayObservabilityJsonForApi((md as Record<string, unknown>) ?? {}),
  }
}

/** Claims payout list / create: never return full internal reference hash. */
export function shapeBlitzpayClaimsPayoutForApi(row: Record<string, unknown>): Record<string, unknown> {
  const { payout_reference_hash: h, organization_id: _org, ...rest } = row
  const raw = h != null ? String(h) : ""
  return {
    ...rest,
    payout_reference_recorded: Boolean(raw),
    payout_reference_probe: raw.length >= 8 ? `${raw.slice(0, 8)}…` : raw ? `${raw}…` : null,
  }
}

/** Portal hosted checkout success: only the hosted redirect URL (clients use redirect, not Stripe object ids). */
export function shapePortalBlitzpayPreparePaySuccessResponse(input: { url: string }): { url: string } {
  return { url: input.url }
}
