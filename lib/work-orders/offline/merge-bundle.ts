import type { WorkOrder, WorkOrderStatus } from "@/lib/mock-data"
import { createClientMutationId } from "@/lib/sync-prep"
import { repairLogFingerprintFromWorkOrder } from "./repair-log-fingerprint"
import {
  makeOutboxBundleId,
  makeWorkOrderOfflineScopeKey,
  type WorkOrderOfflineBundlePayload,
  type WorkOrderOfflineOutboxRecord,
  type WorkOrderOfflinePendingPhotoMeta,
} from "./types"

export type WorkOrderOfflineBundleMergePatch = Partial<WorkOrderOfflineBundlePayload> & {
  appendPendingPhotos?: WorkOrderOfflinePendingPhotoMeta[]
  removePendingPhotoLocalIds?: string[]
}

function uiStatusToDb(s: WorkOrderStatus): string {
  const m: Record<WorkOrderStatus, string> = {
    Open: "open",
    Scheduled: "scheduled",
    "In Progress": "in_progress",
    Completed: "completed",
    "Completed Pending Signature": "completed_pending_signature",
    Invoiced: "invoiced",
  }
  return m[s]
}

export function computeOfflineBaselines(wo: WorkOrder, dbNotes: string): {
  baseServerUpdatedAt: string | null
  baselineRepairFingerprint: string
  baseStatusDb: string | null
} {
  const fp = repairLogFingerprintFromWorkOrder(
    wo.repairLog.problemReported ?? "",
    wo.repairLog,
    dbNotes,
  )
  return {
    baseServerUpdatedAt: wo.serverUpdatedAt ?? null,
    baselineRepairFingerprint: fp,
    baseStatusDb: uiStatusToDb(wo.status),
  }
}

export function offlineBundleHasIntent(p: WorkOrderOfflineBundlePayload): boolean {
  if (p.statusInProgress) return true
  if (p.repair !== null) return true
  if (p.tasks !== null) return true
  if ((p.pendingPhotos?.length ?? 0) > 0) return true
  return false
}

export function mergeTechnicianOfflineBundle(args: {
  existing: WorkOrderOfflineOutboxRecord | undefined
  organizationId: string
  userId: string
  workOrder: WorkOrder
  dbNotes: string
  patch: WorkOrderOfflineBundleMergePatch
}): WorkOrderOfflineOutboxRecord | null {
  const { existing, organizationId, userId, workOrder, dbNotes, patch } = args
  const scopeKey = makeWorkOrderOfflineScopeKey(organizationId, userId, workOrder.id)
  const now = new Date().toISOString()
  const prev: WorkOrderOfflineBundlePayload = existing?.payload ?? {
    repair: null,
    tasks: null,
    statusInProgress: false,
    pendingPhotos: [],
  }
  let nextPhotos = [...(prev.pendingPhotos ?? [])]
  if (patch.removePendingPhotoLocalIds?.length) {
    const rm = new Set(patch.removePendingPhotoLocalIds)
    nextPhotos = nextPhotos.filter((p) => !rm.has(p.localId))
  }
  if (patch.appendPendingPhotos?.length) {
    nextPhotos = [...nextPhotos, ...patch.appendPendingPhotos]
  }
  const next: WorkOrderOfflineBundlePayload = {
    repair: patch.repair !== undefined ? patch.repair : prev.repair,
    tasks: patch.tasks !== undefined ? patch.tasks : prev.tasks,
    statusInProgress: patch.statusInProgress !== undefined ? patch.statusInProgress : prev.statusInProgress,
    pendingPhotos: patch.pendingPhotos !== undefined ? (patch.pendingPhotos ?? []) : nextPhotos,
  }
  if (!offlineBundleHasIntent(next)) return null

  const baselines = existing
    ? {
        baseServerUpdatedAt: existing.baseServerUpdatedAt,
        baselineRepairFingerprint: existing.baselineRepairFingerprint,
        baseStatusDb: existing.baseStatusDb,
      }
    : computeOfflineBaselines(workOrder, dbNotes)

  return {
    id: makeOutboxBundleId(scopeKey),
    scopeKey,
    organizationId,
    userId,
    workOrderId: workOrder.id,
    clientMutationId: existing?.clientMutationId ?? createClientMutationId(),
    actionKind: "wo_technician_bundle",
    status: "queued",
    payload: next,
    ...baselines,
    createdAtIso: existing?.createdAtIso ?? now,
    updatedAtIso: now,
    lastError: null,
  }
}
