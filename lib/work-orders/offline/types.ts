/** Local outbox row status (Phase 53B). */
export type WorkOrderOfflineOutboxStatus =
  | "draft"
  | "queued"
  | "syncing"
  | "failed"
  | "synced"
  | "conflict"

/** Single bundle per work order scope — one replay applies all queued technician-safe edits. */
export type WorkOrderOfflineBundlePayload = {
  repair: {
    problemReported: string
    diagnosis: string
    technicianNotes: string
    notesInternal: string
  } | null
  /** Only when tasks live in `repair_log` JSON (not `work_order_tasks`). */
  tasks: Array<{ id: string; label: string; done: boolean; description?: string }> | null
  /** Open/Scheduled → in_progress */
  statusInProgress: boolean
}

export type WorkOrderOfflineOutboxRecord = {
  /** `${scopeKey}::bundle` */
  id: string
  scopeKey: string
  organizationId: string
  userId: string
  workOrderId: string
  clientMutationId: string
  actionKind: "wo_technician_bundle"
  status: WorkOrderOfflineOutboxStatus
  payload: WorkOrderOfflineBundlePayload
  /** Server `updated_at` when bundle was first created offline. */
  baseServerUpdatedAt: string | null
  baselineRepairFingerprint: string
  /** DB status when bundle started (detect illegal transitions after server moves). */
  baseStatusDb: string | null
  createdAtIso: string
  updatedAtIso: string
  lastError: string | null
  conflictServerUpdatedAt?: string | null
}

export function makeWorkOrderOfflineScopeKey(organizationId: string, userId: string, workOrderId: string): string {
  return `${organizationId}|${userId}|${workOrderId}`
}

export function makeOutboxBundleId(scopeKey: string): string {
  return `${scopeKey}::bundle`
}
