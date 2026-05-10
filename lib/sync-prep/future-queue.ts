import type { SyncPrepOptimisticMutationEnvelope } from "./types"

/**
 * Status for a *future* durable outbox row. Phase 53 does not read or write this anywhere.
 */
export type FutureSyncQueueItemStatus =
  | "pending"
  | "syncing"
  | "failed"
  | "applied"
  | "discarded"

/**
 * Draft record for a sync outbox (IndexedDB / localStorage / future table).
 * Intentionally minimal — expand when offline ships.
 *
 * SECURITY: Payloads must stay org-scoped; never enqueue cross-tenant ids.
 * No runtime queue — this type is documentation + type-checking only.
 */
export interface FutureSyncQueueItem<T = unknown> extends SyncPrepOptimisticMutationEnvelope<T> {
  queueItemId: string
  status: FutureSyncQueueItemStatus
  retryCount: number
  lastErrorMessage?: string | null
  /** When the server acknowledged apply (future). */
  appliedAtServerIso?: string | null
}

/**
 * Placeholder for a future processor. Not implemented — prevents accidental "silent sync".
 */
export function futureSyncQueueNotImplemented(): never {
  throw new Error("Sync queue execution is not implemented (Phase 53 preparation only).")
}
