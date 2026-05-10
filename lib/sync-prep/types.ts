/**
 * Phase 53 — Offline / sync *preparation* types only.
 * No queue runner, no service worker, no automatic replay.
 */

/** Domain slice a future sync job would target (org-scoped on apply). */
export type SyncPrepEntityType =
  | "work_order"
  | "work_order_status"
  | "work_order_repair_log"
  | "work_order_tasks"
  | "work_order_parts_line_items"
  | "work_order_labor"
  | "work_order_attachment"
  | "work_order_signature"
  | "work_order_certificate"
  | "inventory_consume"
  | "unknown"

/** Kind of change for conflict + retry semantics (future). */
export type SyncPrepActionKind = "create" | "update" | "delete" | "upload"

/** How a future reconciler should behave when server state diverged. */
export type SyncPrepConflictPolicy =
  | "server_wins"
  | "client_wins"
  | "last_write_wins"
  | "manual_required"

/**
 * Metadata every queued client mutation should carry (future persistence).
 * `clientGeneratedId` dedupes retries; `createdAtClientIso` supports ordering and audits.
 */
export interface SyncPrepClientMutationMeta {
  clientGeneratedId: string
  organizationId: string
  entityType: SyncPrepEntityType
  entityId?: string | null
  action: SyncPrepActionKind
  createdAtClientIso: string
  conflictPolicy: SyncPrepConflictPolicy
  /** Optional row/version hint for optimistic concurrency (future). */
  baseServerUpdatedAt?: string | null
}

/**
 * Optimistic envelope for UI + future queue rows (payload is domain-specific).
 * Not used by production saves yet — shape-only for upcoming offline work.
 */
export interface SyncPrepOptimisticMutationEnvelope<T = unknown> extends SyncPrepClientMutationMeta {
  payload: T
}

/** Capability flags per technician-heavy flow (audit + UI copy). */
export interface SyncPrepFlowReadiness {
  /** True only when product explicitly supports offline replay for this flow. */
  offlineReplayPlanned: boolean
  /** Today: all listed flows require live Supabase/session. */
  requiresLiveNetwork: boolean
  /** Short label for tooltips / badges. */
  summary: string
}
