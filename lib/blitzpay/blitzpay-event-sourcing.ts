import "server-only"

import { createHash } from "node:crypto"

/** Deterministic JSON string for hashing (sorted object keys; arrays unchanged). */
export function canonicalJsonForBlitzpayEvent(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value))
}

function sortKeysDeep(v: unknown): unknown {
  if (v === null || typeof v !== "object") return v
  if (Array.isArray(v)) return v.map(sortKeysDeep)
  const o = v as Record<string, unknown>
  const keys = Object.keys(o).sort()
  const out: Record<string, unknown> = {}
  for (const k of keys) {
    out[k] = sortKeysDeep(o[k])
  }
  return out
}

/**
 * Stable SHA-256 over org, type, aggregate pointers, version, and canonical payload.
 * Used for replay integrity / dedupe visibility (not Stripe secrets).
 */
export function hashBlitzpayFinancialEvent(input: {
  organizationId: string
  eventType: string
  aggregateType: string | null
  aggregateId: string | null
  eventVersion: number
  eventPayload: Record<string, unknown>
}): string {
  const body = canonicalJsonForBlitzpayEvent({
    organization_id: input.organizationId,
    event_type: input.eventType,
    aggregate_type: input.aggregateType,
    aggregate_id: input.aggregateId,
    event_version: Math.max(1, Math.min(9999, Math.round(input.eventVersion))),
    payload: input.eventPayload ?? {},
  })
  return createHash("sha256").update(body, "utf8").digest("hex")
}

/** Lexicographic ordering of event ids for deterministic replay batches (bounded lists). */
export function orderBlitzpayFinancialEventIdsForReplay(ids: string[]): string[] {
  return [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

/** Replay-safe guard: only terminal failures may be marked replayed via admin flow. */
export function isBlitzpayWorkflowReplayCandidateStatus(status: string): boolean {
  return status === "failed"
}
